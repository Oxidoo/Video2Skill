import { NextRequest, NextResponse } from "next/server";
import { currentUserId } from "@/lib/session";
import { prisma } from "@/lib/db";
import { recordCredit } from "@/lib/credits";
import { creditCost } from "@/lib/billing";
import { JobOptions } from "@/lib/schemas";
import { triggerWorker } from "@/lib/worker-trigger";

export const runtime = "nodejs";

class InsufficientCreditsError extends Error {
  constructor(public required: number, public available: number) {
    super("INSUFFICIENT_CREDITS");
  }
}

// Create a job from an already-uploaded video blob and atomically reserve
// credits for it. The worker picks it up from the queue.
export async function POST(req: NextRequest) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const blobUrl = String(body.blobUrl ?? "");
    const fileName = String(body.fileName ?? "video.mp4").slice(0, 200);
    // Client-provided values are never trusted blindly: NaN/negative would
    // corrupt the credit math (the worker re-checks the real duration anyway).
    const rawDuration = Number(body.durationSec);
    const durationSec =
      Number.isFinite(rawDuration) && rawDuration > 0 ? Math.min(rawDuration, 24 * 3600) : 0;
    const rawBytes = Number(body.videoBytes);
    const videoBytes = Number.isFinite(rawBytes) && rawBytes > 0 ? Math.round(rawBytes) : null;
    const options = JobOptions.parse(body.options ?? {});

    if (!/^https?:\/\//.test(blobUrl)) {
      return NextResponse.json({ error: "Missing or invalid blobUrl" }, { status: 400 });
    }

    const cost = creditCost(durationSec);

    const job = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId }, select: { credits: true } });
      if (!user || user.credits < cost) {
        throw new InsufficientCreditsError(cost, user?.credits ?? 0);
      }
      const created = await tx.job.create({
        data: {
          userId,
          fileName,
          status: "queued",
          stage: "queued",
          progress: 0,
          message: "En file d'attente",
          options,
          videoUrl: blobUrl,
          videoBytes,
          durationSec,
          creditsReserved: cost,
        },
        select: { id: true },
      });
      await recordCredit(tx, {
        userId,
        amount: -cost,
        type: "usage",
        description: `Traitement — ${fileName}`,
        jobId: created.id,
      });
      return created;
    });

    // Wake up the GitHub Actions worker (fail-soft: if not configured, the
    // workflow's safety-net cron will pick the job up).
    await triggerWorker();

    return NextResponse.json({ jobId: job.id, cost });
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      return NextResponse.json(
        { error: "INSUFFICIENT_CREDITS", required: err.required, available: err.available },
        { status: 402 }
      );
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create job" },
      { status: 500 }
    );
  }
}

// List the current user's jobs (most recent first).
export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const jobs = await prisma.job.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      fileName: true,
      status: true,
      stage: true,
      progress: true,
      message: true,
      error: true,
      durationSec: true,
      qualityScore: true,
      creditsReserved: true,
      creditsCharged: true,
      skillUrl: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return NextResponse.json({ jobs });
}
