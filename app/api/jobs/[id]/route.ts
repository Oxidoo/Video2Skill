import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/session";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const job = await prisma.job.findFirst({
    where: { id, userId },
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
      reportUrl: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  return NextResponse.json(job);
}
