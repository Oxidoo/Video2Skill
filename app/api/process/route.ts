import { NextRequest, NextResponse } from "next/server";
import { readJob } from "@/lib/jobs";
import { startPipeline } from "@/lib/pipeline";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { jobId } = await req.json();
    if (!jobId) return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
    const job = await readJob(jobId);
    if (job.stage !== "uploaded" && job.stage !== "failed") {
      return NextResponse.json({ error: `Job not ready (stage: ${job.stage})` }, { status: 409 });
    }
    startPipeline(jobId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to start processing" },
      { status: 500 }
    );
  }
}
