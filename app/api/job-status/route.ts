import { NextRequest, NextResponse } from "next/server";
import { readJob } from "@/lib/jobs";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get("jobId");
  if (!jobId) return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
  try {
    return NextResponse.json(await readJob(jobId));
  } catch {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }
}
