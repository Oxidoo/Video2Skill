import { NextRequest, NextResponse } from "next/server";
import { currentUserId } from "@/lib/session";
import { prisma } from "@/lib/db";
import { recordCredit } from "@/lib/credits";
import { creditCost } from "@/lib/billing";
import { JobOptions } from "@/lib/schemas";
import { triggerWorker } from "@/lib/worker-trigger";
import { normalizeYoutubeUrl, fetchYoutubeInfo } from "@/lib/youtube";

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
    const options = JobOptions.parse(body.options ?? {});
    const youtube = typeof body.youtubeUrl === "string" ? body.youtubeUrl.trim() : "";

    let videoUrl: string;
    let fileName: string;
    let durationSec: number;
    let videoBytes: number | null = null;

    if (youtube) {
      const canonical = normalizeYoutubeUrl(youtube);
      if (!canonical) {
        return NextResponse.json({ error: "Invalid YouTube URL" }, { status: 400 });
      }
      const info = await fetchYoutubeInfo(canonical);
      videoUrl = canonical;
      fileName = (info.title ?? "YouTube video").slice(0, 200);
      // Fall back to a 10-min estimate when the duration can't be read; the
      // worker re-probes and settles the exact amount anyway.
      durationSec = Math.min(info.durationSec > 0 ? info.durationSec : 600, 24 * 3600);
    } else {
      const blobUrl = String(body.blobUrl ?? "");
      if (!/^https?:\/\//.test(blobUrl)) {
        return NextResponse.json({ error: "Missing or invalid blobUrl" }, { status: 400 });
      }
      videoUrl = blobUrl;
      fileName = String(body.fileName ?? "video.mp4").slice(0, 200);
      // Client values are never trusted blindly: NaN/negative would corrupt the
      // credit math (the worker re-checks the real duration anyway).
      const rawDuration = Number(body.durationSec);
      durationSec =
        Number.isFinite(rawDuration) && rawDuration > 0 ? Math.min(rawDuration, 24 * 3600) : 0;
      const rawBytes = Number(body.videoBytes);
      videoBytes = Number.isFinite(rawBytes) && rawBytes > 0 ? Math.round(rawBytes) : null;
    }

    const cost = creditCost(durationSec, options.outputType);

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
          message: "Queued",
          options,
          videoUrl,
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
        description: `Processing — ${fileName}`,
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
