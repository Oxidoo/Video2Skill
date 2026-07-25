import { NextResponse } from "next/server";
import { clientKey, freeQuota } from "@/lib/anon";
import { config } from "@/lib/config";
import { prisma } from "@/lib/db";
import { JobOptions } from "@/lib/schemas";
import { triggerWorker } from "@/lib/worker-trigger";
import { fetchYoutubeInfo, normalizeYoutubeUrl } from "@/lib/youtube";

export const runtime = "nodejs";

/**
 * Free, no-account timestamped transcript for a short public YouTube video.
 *
 * This is the top of the funnel, not a giveaway of the product: it costs only
 * the transcription call, and it demonstrates exactly the gap the paid product
 * fills — a transcript cannot tell an AI what was on screen.
 */
export async function POST(req: Request) {
  if (!config.freeTranscriptEnabled) {
    return NextResponse.json({ error: "Free transcripts are disabled." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const url = String((body as { url?: unknown })?.url ?? "").trim();
  const canonical = normalizeYoutubeUrl(url);
  if (!canonical) {
    return NextResponse.json(
      { error: "Paste a public YouTube link (youtube.com/watch or youtu.be)." },
      { status: 400 }
    );
  }

  const anonKey = clientKey(req);
  const quota = await freeQuota(anonKey);
  if (!quota.allowed) {
    return NextResponse.json(
      {
        error: `Free limit reached (${quota.limit} per day). Sign in for credits to keep going.`,
        quota,
      },
      { status: 429 }
    );
  }

  const info = await fetchYoutubeInfo(canonical);
  const maxSec = config.freeTranscriptMaxMinutes * 60;
  if (info.durationSec > maxSec) {
    return NextResponse.json(
      {
        error: `That video is ${Math.round(info.durationSec / 60)} min. The free transcript covers videos up to ${config.freeTranscriptMaxMinutes} min — sign in to process longer ones.`,
      },
      { status: 413 }
    );
  }
  if (info.durationSec <= 0) {
    return NextResponse.json(
      { error: "Could not read that video — it may be private, age-restricted or region-locked." },
      { status: 400 }
    );
  }

  const job = await prisma.job.create({
    data: {
      userId: null,
      anonKey,
      fileName: (info.title ?? "YouTube video").slice(0, 200),
      status: "queued",
      stage: "queued",
      message: "Queued",
      // Free tier is transcript-only by definition — the expensive stages
      // (frames, OCR, vision, synthesis) never run.
      options: JobOptions.parse({ outputType: "transcript", language: "auto" }),
      videoUrl: canonical,
      sourceUrl: canonical,
      durationSec: info.durationSec,
      creditsReserved: 0,
    },
    select: { id: true },
  });

  await triggerWorker();

  return NextResponse.json({
    jobId: job.id,
    title: info.title,
    durationSec: info.durationSec,
    quota: { ...quota, used: quota.used + 1, remaining: quota.remaining - 1 },
  });
}

/** Remaining free allowance for this client, for the UI to show up front. */
export async function GET(req: Request) {
  if (!config.freeTranscriptEnabled) {
    return NextResponse.json({ enabled: false });
  }
  const quota = await freeQuota(clientKey(req));
  return NextResponse.json({
    enabled: true,
    maxMinutes: config.freeTranscriptMaxMinutes,
    quota,
  });
}
