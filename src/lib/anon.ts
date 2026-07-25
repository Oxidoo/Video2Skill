import { createHash } from "crypto";
import { prisma } from "./db";
import { config } from "./config";

/**
 * Stable, non-reversible identifier for an unauthenticated client.
 *
 * Only ever the salted hash is stored: the free tier needs to count how many
 * jobs one client started today, which does not require keeping addresses.
 * The salt makes the hashes useless outside this deployment.
 */
export function clientKey(req: Request): string {
  const headers = req.headers;
  const forwarded = headers.get("x-forwarded-for") ?? "";
  const ip =
    forwarded.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    headers.get("cf-connecting-ip") ||
    "unknown";
  const salt = process.env.ANON_SALT ?? process.env.AUTH_SECRET ?? "video2skill";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

export interface FreeQuota {
  used: number;
  limit: number;
  remaining: number;
  allowed: boolean;
}

/** How much of today's free allowance this client has left. */
export async function freeQuota(anonKey: string): Promise<FreeQuota> {
  const since = new Date(Date.now() - 24 * 3600 * 1000);
  const used = await prisma.job.count({
    where: { anonKey, createdAt: { gte: since } },
  });
  const limit = config.freeTranscriptPerDay;
  return {
    used,
    limit,
    remaining: Math.max(0, limit - used),
    allowed: used < limit,
  };
}
