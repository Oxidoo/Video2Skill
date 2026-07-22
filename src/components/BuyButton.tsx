"use client";

import { useState } from "react";
import { signIn, useSession } from "next-auth/react";

export function BuyButton({
  packId,
  label,
  highlight,
}: {
  packId: string;
  label: string;
  highlight?: boolean;
}) {
  const { status } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function buy() {
    if (status !== "authenticated") {
      signIn("google", { callbackUrl: "/pricing" });
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setError(
        res.status === 503
          ? "Le paiement n'est pas encore configuré (clés Stripe manquantes)."
          : data.error ?? "Erreur"
      );
    } catch {
      setError("Erreur réseau");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={buy}
        disabled={loading}
        className={`w-full rounded-lg px-5 py-2.5 font-medium transition-colors disabled:opacity-50 ${
          highlight
            ? "bg-gray-900 text-white hover:bg-gray-700"
            : "border border-gray-300 bg-white text-gray-900 hover:bg-gray-50"
        }`}
      >
        {loading ? "Redirection…" : label}
      </button>
      {error && <p className="mt-2 text-center text-xs text-red-600">{error}</p>}
    </div>
  );
}
