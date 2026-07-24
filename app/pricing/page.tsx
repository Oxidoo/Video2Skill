import type { Metadata } from "next";
import Link from "next/link";
import {
  CREDIT_PACKS,
  formatPrice,
  CREDITS_PER_MINUTE,
  SIGNUP_BONUS_CREDITS,
} from "@/lib/billing";
import { BuyButton } from "@/components/BuyButton";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Video2Skill pricing: pay as you go in credits, 1 credit per minute of video, cheaper for transcript-only. Free credits on sign-up, no subscription.",
  alternates: { canonical: "/pricing" },
};

export default function PricingPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <header className="text-center">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Pricing</h1>
        <p className="mx-auto mt-3 max-w-xl text-gray-600">
          Pay as you go, no subscription. {CREDITS_PER_MINUTE} credit
          {CREDITS_PER_MINUTE > 1 ? "s" : ""} per minute of video (billed per started minute),
          cheaper for transcript-only. {SIGNUP_BONUS_CREDITS} free credits on sign-up.
        </p>
      </header>

      <div className="mt-12 grid gap-6 sm:grid-cols-3">
        {CREDIT_PACKS.map((pack) => (
          <div
            key={pack.id}
            className={`flex flex-col rounded-2xl border bg-white p-6 ${
              pack.highlight ? "border-gray-900 shadow-sm" : "border-gray-200"
            }`}
          >
            {pack.highlight && (
              <span className="mb-3 inline-block w-fit rounded-full bg-gray-900 px-3 py-1 text-xs font-semibold text-white">
                Popular
              </span>
            )}
            <h3 className="text-lg font-semibold text-gray-900">{pack.name}</h3>
            <p className="mt-3 text-3xl font-bold text-gray-900">{formatPrice(pack)}</p>
            <p className="mt-1 text-sm text-gray-500">
              {pack.credits} credits · ≈ {Math.floor(pack.credits / CREDITS_PER_MINUTE)} min of video
            </p>
            <div className="mt-6">
              <BuyButton
                packId={pack.id}
                highlight={pack.highlight}
                label={`Buy ${formatPrice(pack)}`}
              />
            </div>
          </div>
        ))}
      </div>

      <p className="mt-10 text-center text-sm text-gray-500">
        Already have an account?{" "}
        <Link href="/dashboard" className="font-medium text-gray-900 underline">
          Go to the studio
        </Link>
      </p>
    </main>
  );
}
