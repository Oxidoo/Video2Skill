import { NextRequest, NextResponse } from "next/server";
import { currentUserId } from "@/lib/session";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

// Proxies the generated artifact from blob storage so downloads stay behind
// authentication and ownership checks rather than exposing the raw blob URL.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const which = req.nextUrl.searchParams.get("file") ?? "skill";

  const job = await prisma.job.findFirst({
    where: { id, userId },
    select: { status: true, skillUrl: true, reportUrl: true },
  });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  if (job.status !== "done") {
    return NextResponse.json({ error: "Job not finished" }, { status: 409 });
  }

  const isReport = which === "report";
  const url = isReport ? job.reportUrl : job.skillUrl;
  if (!url) return NextResponse.json({ error: "File not available" }, { status: 404 });

  const upstream = await fetch(url);
  if (!upstream.ok) return NextResponse.json({ error: "File not available" }, { status: 502 });
  const content = await upstream.arrayBuffer();

  return new NextResponse(content, {
    headers: {
      "Content-Type": isReport ? "application/json" : "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${isReport ? "report.json" : "skill.md"}"`,
    },
  });
}
