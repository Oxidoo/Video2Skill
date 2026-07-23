import { NextRequest, NextResponse } from "next/server";
import { currentUserId } from "@/lib/session";
import { prisma } from "@/lib/db";
import { stripe, isStripeConfigured } from "@/lib/stripe";
import { findPack } from "@/lib/billing";
import { SITE } from "@/lib/site";

export const runtime = "nodejs";

// The exact host the user's browser is on. Using the request Origin header (sent
// on the same-origin POST from the page) guarantees the Stripe return lands back
// on the same domain as the session cookie — otherwise Vercel's internal
// deployment host can leak in and the user appears logged out after paying.
function browserOrigin(req: NextRequest): string {
  const origin = req.headers.get("origin");
  if (origin) return origin.replace(/\/$/, "");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (host) {
    const proto = req.headers.get("x-forwarded-proto") ?? "https";
    return `${proto}://${host}`;
  }
  return SITE.url;
}

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

  const origin = browserOrigin(req);

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
