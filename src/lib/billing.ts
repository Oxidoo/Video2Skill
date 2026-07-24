// Credit pricing and purchasable packs. Business config — safe to edit.
// Prices are in the smallest currency unit (cents).

export const CREDITS_PER_MINUTE = Number(process.env.CREDITS_PER_MINUTE ?? 1);
export const SIGNUP_BONUS_CREDITS = Number(process.env.SIGNUP_BONUS_CREDITS ?? 10);
// Transcript-only jobs are far cheaper to run, so they cost less: one credit
// per this many minutes of video.
export const TRANSCRIPT_MINUTES_PER_CREDIT = Number(process.env.TRANSCRIPT_MINUTES_PER_CREDIT ?? 3);

export type OutputType = "skill" | "transcript";

/** Credits charged for a video, depending on the requested output. */
export function creditCost(durationSec: number, outputType: OutputType = "skill"): number {
  const minutes = Math.max(1, Math.ceil((durationSec || 0) / 60));
  if (outputType === "transcript") {
    return Math.max(1, Math.ceil(minutes / TRANSCRIPT_MINUTES_PER_CREDIT));
  }
  return minutes * CREDITS_PER_MINUTE;
}

export interface CreditPack {
  id: string;
  name: string;
  credits: number;
  priceCents: number;
  currency: string;
  highlight?: boolean;
}

export const CREDIT_PACKS: CreditPack[] = [
  { id: "starter", name: "Starter", credits: 30, priceCents: 900, currency: "usd" },
  { id: "pro", name: "Pro", credits: 250, priceCents: 2900, currency: "usd", highlight: true },
  { id: "business", name: "Business", credits: 1200, priceCents: 9900, currency: "usd" },
];

export function findPack(id: string): CreditPack | undefined {
  return CREDIT_PACKS.find((p) => p.id === id);
}

export function formatPrice(pack: Pick<CreditPack, "priceCents" | "currency">): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: pack.currency,
  }).format(pack.priceCents / 100);
}
