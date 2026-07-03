import fs from "fs/promises";
import { NextRequest, NextResponse } from "next/server";
import { jobPaths, readJob } from "@/lib/jobs";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get("jobId");
  const file = req.nextUrl.searchParams.get("file") ?? "skill";
  if (!jobId) return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
  try {
    const job = await readJob(jobId);
    if (job.stage !== "done") {
      return NextResponse.json({ error: "Job not finished" }, { status: 409 });
    }
    const p = jobPaths(jobId);
    if (file === "report") {
      const content = await fs.readFile(p.report);
      return new NextResponse(content, {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="report.json"`,
        },
      });
    }
    const content = await fs.readFile(p.skill);
    return new NextResponse(content, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="skill.md"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
