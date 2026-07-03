import fs from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { createJob, jobPaths, updateJob } from "@/lib/jobs";
import { JobOptions } from "@/lib/schemas";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const chunk = form.get("chunk");
    const chunkIndex = Number(form.get("chunkIndex"));
    const fileName = String(form.get("fileName") ?? "video.mp4");
    let jobId = form.get("jobId") ? String(form.get("jobId")) : null;

    if (!(chunk instanceof Blob) || Number.isNaN(chunkIndex)) {
      return NextResponse.json({ error: "Missing chunk or chunkIndex" }, { status: 400 });
    }

    if (!jobId) {
      const options = JobOptions.parse(JSON.parse(String(form.get("options") ?? "{}")));
      const job = await createJob(fileName, options);
      jobId = job.jobId;
      await updateJob(jobId, { stage: "uploading", message: "Upload en cours" });
    }

    const chunkPath = path.join(jobPaths(jobId).chunks, `chunk_${String(chunkIndex).padStart(5, "0")}`);
    await fs.writeFile(chunkPath, Buffer.from(await chunk.arrayBuffer()));

    return NextResponse.json({ jobId });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 }
    );
  }
}
