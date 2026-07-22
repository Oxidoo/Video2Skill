import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/session";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, image: true, credits: true, isAdmin: true },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const transactions = await prisma.creditTransaction.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { id: true, amount: true, type: true, description: true, createdAt: true },
  });

  return NextResponse.json({ ...user, transactions });
}
