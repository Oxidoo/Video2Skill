import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "./db";

type Db = PrismaClient | Prisma.TransactionClient;

export type CreditType =
  | "purchase"
  | "signup_bonus"
  | "grant"
  | "usage"
  | "adjustment"
  | "refund";

/**
 * Append to the credit ledger and move the user's balance by the same amount.
 * `amount` is positive for top-ups (purchase / grant / refund) and negative for
 * usage. Pass a transaction client when this must be atomic with other writes
 * (e.g. reserving credits while creating a job).
 */
export async function recordCredit(
  db: Db,
  args: {
    userId: string;
    amount: number;
    type: CreditType;
    description?: string;
    jobId?: string;
    stripeSessionId?: string;
  }
): Promise<void> {
  await db.creditTransaction.create({
    data: {
      userId: args.userId,
      amount: args.amount,
      type: args.type,
      description: args.description ?? null,
      jobId: args.jobId ?? null,
      stripeSessionId: args.stripeSessionId ?? null,
    },
  });
  await db.user.update({
    where: { id: args.userId },
    data: { credits: { increment: args.amount } },
  });
}

export async function getBalance(userId: string): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { credits: true },
  });
  return user?.credits ?? 0;
}
