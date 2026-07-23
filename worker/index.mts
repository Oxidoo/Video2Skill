/**
 * Video2Skill processing worker.
 *
 * Deploy this as a long-running container (Railway / Render / Fly / a VM) with
 * FFmpeg + Tesseract installed — see Dockerfile.worker. It polls Postgres for
 * queued jobs, downloads the uploaded video from blob storage, runs the full
 * FFmpeg / Tesseract / AI pipeline, uploads skill.md back to blob storage and
 * settles the reserved credits.
 *
 * Run locally with: npm run worker
 *
 * Required env: DATABASE_URL, BLOB_READ_WRITE_TOKEN, OPENAI_API_KEY,
 * ANTHROPIC_API_KEY (+ the pipeline tuning vars in src/lib/config.ts).
 */
import dotenv from "dotenv";
// Local dev convenience — load .env.local then .env. Platform-provided env vars
// (Railway/Render/Fly) already sit in process.env and are never overridden.
dotenv.config({ path: ".env.local" });
dotenv.config();

import fs from "fs/promises";
import fsSync from "fs";
import os from "os";
import path from "path";
import { Readable } from "stream";
import { pipeline as streamPipeline } from "stream/promises";

import { prisma } from "../src/lib/db";
import { processVideo } from "../src/lib/pipeline-core";
import { putArtifact } from "../src/lib/blob";
import { recordCredit } from "../src/lib/credits";
import { creditCost } from "../src/lib/billing";
import { JobOptions } from "../src/lib/schemas";
import type { Job } from "@prisma/client";

const POLL_MS = Number(process.env.WORKER_POLL_MS ?? 5000);
const TMP_BASE = process.env.WORKER_TMP_DIR ?? os.tmpdir();
const PROGRESS_MIN_INTERVAL_MS = 1500;

// Drain mode: process everything queued, then exit. Used by the GitHub Actions
// workflow (each dispatch spins a runner, drains the queue and shuts down).
const DRAIN =
  process.argv.includes("--drain") ||
  process.argv.includes("--once") ||
  process.env.WORKER_MODE === "drain";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Atomically claim the oldest queued job (safe across multiple workers). */
async function claimNextJob(): Promise<string | null> {
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    UPDATE "Job"
       SET status = 'processing', stage = 'probing', message = 'Démarrage du traitement', "updatedAt" = now()
     WHERE id = (
       SELECT id FROM "Job"
        WHERE status = 'queued'
        ORDER BY "createdAt" ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
     )
     RETURNING id;
  `;
  return rows[0]?.id ?? null;
}

async function downloadTo(url: string, dest: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`Téléchargement de la vidéo échoué (${res.status})`);
  await streamPipeline(Readable.fromWeb(res.body as never), fsSync.createWriteStream(dest));
}

const STALE_PROCESSING_MIN = Number(process.env.STALE_PROCESSING_MIN ?? 2);

/**
 * Re-queue jobs stuck in "processing" (worker killed mid-job: runner cancelled,
 * workflow timeout, crash). Safe under the single-worker invariant enforced by
 * the workflow concurrency group — raise STALE_PROCESSING_MIN if several
 * workers ever run in parallel.
 */
async function requeueStaleJobs(): Promise<void> {
  const cutoff = new Date(Date.now() - STALE_PROCESSING_MIN * 60_000);
  const res = await prisma.job.updateMany({
    where: { status: "processing", updatedAt: { lt: cutoff } },
    data: {
      status: "queued",
      stage: "queued",
      progress: 0,
      message: "Reprise après interruption du worker",
    },
  });
  if (res.count > 0) console.log(`[worker] requeued ${res.count} interrupted job(s)`);
}

/** Refund the whole reservation when a job fails. */
async function refundReservation(job: Job): Promise<void> {
  if (job.creditsReserved > 0) {
    await recordCredit(prisma, {
      userId: job.userId,
      amount: job.creditsReserved,
      type: "refund",
      description: `Remboursement — ${job.fileName}`,
      jobId: job.id,
    });
  }
}

/** Reconcile reserved vs. actual cost on success; returns the amount charged. */
async function settleUsage(job: Job, actualDurationSec: number): Promise<number> {
  const actual = creditCost(actualDurationSec);
  const adjustment = job.creditsReserved - actual; // >0 give back, <0 charge extra
  if (adjustment !== 0) {
    await prisma.$transaction(async (tx) => {
      let amount = adjustment;
      if (amount < 0) {
        const u = await tx.user.findUnique({
          where: { id: job.userId },
          select: { credits: true },
        });
        amount = Math.max(amount, -(u?.credits ?? 0)); // never drive the balance negative
      }
      if (amount !== 0) {
        await recordCredit(tx, {
          userId: job.userId,
          amount,
          type: "adjustment",
          description: `Ajustement crédits — ${job.fileName}`,
          jobId: job.id,
        });
      }
    });
  }
  return actual;
}

async function processJob(jobId: string): Promise<void> {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) return;

  const workDir = path.join(TMP_BASE, `v2s-${jobId}`);
  const videoPath = path.join(workDir, "video");

  // Throttle progress-only writes; always flush on stage/message changes.
  let lastWrite = 0;

  try {
    if (!job.videoUrl) throw new Error("Aucune vidéo associée à ce job.");
    await fs.mkdir(workDir, { recursive: true });

    await prisma.job.update({
      where: { id: jobId },
      data: { stage: "uploaded", progress: 3, message: "Téléchargement de la vidéo" },
    });
    await downloadTo(job.videoUrl, videoPath);

    const options = JobOptions.parse(job.options);

    const result = await processVideo({
      videoPath,
      workDir,
      fileName: job.fileName,
      options,
      // Guard against under-reported client durations: refuse to burn expensive
      // AI work the user cannot pay for (only the cheap probe has run so far).
      onProbe: async (meta) => {
        const actual = creditCost(meta.durationSec);
        const u = await prisma.user.findUnique({
          where: { id: job.userId },
          select: { credits: true },
        });
        const affordable = job.creditsReserved + (u?.credits ?? 0);
        if (actual > affordable) {
          throw new Error(
            `Durée réelle (${Math.round(meta.durationSec)}s → ${actual} crédits) supérieure au solde disponible (${affordable} crédits).`
          );
        }
      },
      onProgress: async (u) => {
        const now = Date.now();
        const structural = u.stage !== undefined || u.message !== undefined;
        if (!structural && now - lastWrite < PROGRESS_MIN_INTERVAL_MS) return;
        lastWrite = now;
        await prisma.job.update({
          where: { id: jobId },
          data: {
            ...(u.stage !== undefined ? { stage: u.stage } : {}),
            ...(u.progress !== undefined ? { progress: u.progress } : {}),
            ...(u.message !== undefined ? { message: u.message } : {}),
          },
        });
      },
    });

    const prefix = `jobs/${jobId}`;
    const [skill, report, timeline] = await Promise.all([
      putArtifact(`${prefix}/skill.md`, result.skillMd, "text/markdown; charset=utf-8"),
      putArtifact(`${prefix}/report.json`, result.reportJson, "application/json"),
      putArtifact(`${prefix}/timeline.json`, result.timelineJson, "application/json"),
    ]);

    const charged = await settleUsage(job, result.durationSec);

    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: "done",
        stage: "done",
        progress: 100,
        message: "skill.md prêt",
        error: null,
        skillUrl: skill.url,
        reportUrl: report.url,
        timelineUrl: timeline.url,
        qualityScore: result.report.score,
        durationSec: result.durationSec,
        meta: result.meta as object,
        creditsCharged: charged,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[worker] job ${jobId} failed:`, message);
    await refundReservation(job).catch((e) => console.error("[worker] refund failed", e));
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: "failed",
        stage: "failed",
        error: message,
        message: "Échec du traitement (crédits remboursés)",
        creditsCharged: 0,
      },
    });
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

function checkEnv() {
  const required = ["DATABASE_URL", "BLOB_READ_WRITE_TOKEN", "OPENAI_API_KEY", "ANTHROPIC_API_KEY"];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    console.warn(`[worker] WARNING: missing env vars: ${missing.join(", ")}`);
  }
}

/** Target DB endpoint for startup logs — never includes credentials. */
function describeDb(): string {
  try {
    const u = new URL(process.env.DATABASE_URL ?? "");
    return `${u.hostname}:${u.port}${u.pathname}`;
  } catch {
    return "(DATABASE_URL invalide ou absente)";
  }
}

async function main() {
  checkEnv();
  console.log(
    `[worker] started in ${DRAIN ? "drain" : "poll"} mode — polling every ${POLL_MS}ms (tmp: ${TMP_BASE})`
  );
  console.log(`[worker] db target: ${describeDb()}`);
  await requeueStaleJobs().catch((err) => console.error("[worker] requeue failed:", err));

  let running = true;
  const stop = () => {
    console.log("[worker] shutting down after current job…");
    running = false;
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  let consecutiveErrors = 0;
  while (running) {
    try {
      const jobId = await claimNextJob();
      consecutiveErrors = 0;
      if (jobId) {
        console.log(`[worker] processing job ${jobId}`);
        await processJob(jobId);
        console.log(`[worker] done with job ${jobId}`);
        continue; // grab the next one immediately
      }
      if (DRAIN) {
        console.log("[worker] queue empty — drain mode, exiting.");
        break;
      }
    } catch (err) {
      console.error("[worker] loop error:", err);
      // In drain mode a persistent DB outage must fail the CI run (visibly)
      // instead of looping forever on a billed runner.
      if (DRAIN && ++consecutiveErrors >= 5) {
        console.error("[worker] too many consecutive errors in drain mode — aborting.");
        process.exitCode = 1;
        break;
      }
    }
    await sleep(POLL_MS);
  }

  await prisma.$disconnect();
  process.exit(process.exitCode ?? 0);
}

main();
