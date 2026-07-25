import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

/**
 * Status + result for an anonymous free-tier job.
 *
 * Scoped to `userId: null` so this endpoint can never be used to read a
 * signed-in user's job by guessing an id. What it does expose is the transcript
 * of a public YouTube video that the caller just submitted, keyed by an
 * unguessable job id.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const job = await prisma.job.findFirst({
    where: { id, userId: null },
    select: {
      id: true,
      fileName: true,
      status: true,
      stage: true,
      progress: true,
      message: true,
      error: true,
      durationSec: true,
      skillUrl: true,
      sourceUrl: true,
    },
  });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let transcript: string | null = null;
  if (job.status === "done" && job.skillUrl) {
    try {
      const upstream = await fetch(job.skillUrl);
      // Cap the inline payload: the page renders it, and a 4-hour talk would
      // otherwise be megabytes of JSON.
      if (upstream.ok) transcript = (await upstream.text()).slice(0, 400_000);
    } catch {
      transcript = null;
    }
  }

  return NextResponse.json({
    id: job.id,
    title: job.fileName,
    status: job.status,
    stage: job.stage,
    progress: job.progress,
    message: job.message,
    error: job.error,
    durationSec: job.durationSec,
    sourceUrl: job.sourceUrl,
    transcript,
  });
}
