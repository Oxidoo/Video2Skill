import { NextRequest, NextResponse } from "next/server";
import { currentUserId } from "@/lib/session";
import { prisma } from "@/lib/db";
import { stripe, isStripeConfigured } from "@/lib/stripe";
import { findPack } from "@/lib/billing";

export const runtime = "nodejs";

// Creates a Stripe Checkout session to buy a credit pack. The webhook credits
// the account once payment succeeds.
export async function POST(req: NextRequest) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Billing not configured" }, { status: 503 });
  }

  const { packId } = await req.json();
  const pack = findPack(String(packId));
  if (!pack) return NextResponse.json({ error: "Unknown pack" }, { status: 400 });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  // Redirect back to the domain the user is actually on (keeps them on-domain
  // after payment, regardless of any stale env var).
  const origin = new URL(req.url).origin;

  const checkout = await stripe().checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: pack.currency,
          unit_amount: pack.priceCents,
          product_data: { name: `Video2Skill — ${pack.credits} crédits (${pack.name})` },
        },
      },
    ],
    client_reference_id: userId,
    customer_email: user?.email ?? undefined,
    metadata: { userId, credits: String(pack.credits), packId: pack.id },
    success_url: `${origin}/dashboard?purchase=success`,
    cancel_url: `${origin}/pricing?purchase=cancel`,
  });

  return NextResponse.json({ url: checkout.url });
}
