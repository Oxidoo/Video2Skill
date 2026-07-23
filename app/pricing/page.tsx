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
  title: "Tarifs",
  description:
    "Tarifs Video2Skill : paiement à l'usage en crédits, 1 crédit par minute de vidéo. Crédits offerts à l'inscription, sans abonnement.",
  alternates: { canonical: "/pricing" },
};

export default function PricingPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <header className="text-center">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Tarifs</h1>
        <p className="mx-auto mt-3 max-w-xl text-gray-600">
          Paiement à l'usage, sans abonnement. {CREDITS_PER_MINUTE} crédit
          {CREDITS_PER_MINUTE > 1 ? "s" : ""} par minute de vidéo (facturée à la minute entamée).{" "}
          {SIGNUP_BONUS_CREDITS} crédits offerts à l'inscription.
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
                Populaire
              </span>
            )}
            <h3 className="text-lg font-semibold text-gray-900">{pack.name}</h3>
            <p className="mt-3 text-3xl font-bold text-gray-900">{formatPrice(pack)}</p>
            <p className="mt-1 text-sm text-gray-500">
              {pack.credits} crédits · ≈ {Math.floor(pack.credits / CREDITS_PER_MINUTE)} min de vidéo
            </p>
            <div className="mt-6">
              <BuyButton
                packId={pack.id}
                highlight={pack.highlight}
                label={`Acheter ${formatPrice(pack)}`}
              />
            </div>
          </div>
        ))}
      </div>

      <p className="mt-10 text-center text-sm text-gray-500">
        Déjà un compte ?{" "}
        <Link href="/dashboard" className="font-medium text-gray-900 underline">
          Aller au studio
        </Link>
      </p>
    </main>
  );
}
