import fs from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { jobPaths, updateJob } from "@/lib/jobs";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { jobId, totalChunks } = await req.json();
    if (!jobId) return NextResponse.json({ error: "Missing jobId" }, { status: 400 });

    const p = jobPaths(jobId);
    const chunkFiles = (await fs.readdir(p.chunks)).sort();
    if (chunkFiles.length !== Number(totalChunks)) {
      return NextResponse.json(
        { error: `Expected ${totalChunks} chunks, got ${chunkFiles.length}` },
        { status: 400 }
      );
    }

    // Assemble sequentially with a write stream to avoid loading GBs in memory.
    const handle = await fs.open(p.video, "w");
    try {
      for (const f of chunkFiles) {
        const data = await fs.readFile(path.join(p.chunks, f));
        await handle.write(data);
      }
    } finally {
      await handle.close();
    }
    await fs.rm(p.chunks, { recursive: true, force: true });

    await updateJob(jobId, { stage: "uploaded", progress: 3, message: "Vidéo assemblée" });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Assembly failed" },
      { status: 500 }
    );
  }
}
