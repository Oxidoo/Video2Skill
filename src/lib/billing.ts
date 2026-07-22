// Credit pricing and purchasable packs. This is business config — safe to edit.
// Prices are in the smallest currency unit (cents).

export const CREDITS_PER_MINUTE = Number(process.env.CREDITS_PER_MINUTE ?? 1);
export const SIGNUP_BONUS_CREDITS = Number(process.env.SIGNUP_BONUS_CREDITS ?? 10);

/** Credits charged for a video of the given duration (billed per started minute). */
export function creditCost(durationSec: number): number {
  const minutes = Math.max(1, Math.ceil((durationSec || 0) / 60));
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
  { id: "starter", name: "Starter", credits: 60, priceCents: 900, currency: "eur" },
  { id: "pro", name: "Pro", credits: 250, priceCents: 2900, currency: "eur", highlight: true },
  { id: "business", name: "Business", credits: 1200, priceCents: 9900, currency: "eur" },
];

export function findPack(id: string): CreditPack | undefined {
  return CREDIT_PACKS.find((p) => p.id === id);
}

export function formatPrice(pack: Pick<CreditPack, "priceCents" | "currency">): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: pack.currency,
  }).format(pack.priceCents / 100);
}
