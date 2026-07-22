import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/db";
import { recordCredit } from "@/lib/credits";

export const runtime = "nodejs";

// Stripe delivers payment confirmations here. Configure the endpoint URL and
// signing secret (STRIPE_WEBHOOK_SECRET) in the Stripe dashboard.
export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = req.headers.get("stripe-signature");
  if (!secret || !signature) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 400 });
  }

  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(raw, signature, secret);
  } catch (err) {
    return NextResponse.json(
      { error: `Signature check failed: ${err instanceof Error ? err.message : err}` },
      { status: 400 }
    );
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.userId;
    const credits = Number(session.metadata?.credits ?? 0);

    if (userId && credits > 0) {
      // Idempotent: the unique stripeSessionId guards against duplicate events.
      const existing = await prisma.creditTransaction.findUnique({
        where: { stripeSessionId: session.id },
      });
      if (!existing) {
        await recordCredit(prisma, {
          userId,
          amount: credits,
          type: "purchase",
          description: `Achat de ${credits} crédits`,
          stripeSessionId: session.id,
        });
      }
    }
  }

  return NextResponse.json({ received: true });
}
