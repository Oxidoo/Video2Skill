"use client";

import Link from "next/link";
import { useSession, signIn, signOut } from "next-auth/react";

export function SiteHeader() {
  const { data: session, status } = useSession();
  const authed = status === "authenticated";

  return (
    <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
        <Link href="/" className="text-lg font-bold tracking-tight text-gray-900">
          Video2Skill
        </Link>

        <nav className="flex items-center gap-4 text-sm">
          <Link href="/pricing" className="text-gray-600 hover:text-gray-900">
            Tarifs
          </Link>

          {authed ? (
            <>
              <Link href="/dashboard" className="text-gray-600 hover:text-gray-900">
                Dashboard
              </Link>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                {session.user.credits} crédits
              </span>
              {session.user.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={session.user.image}
                  alt=""
                  className="h-7 w-7 rounded-full"
                  referrerPolicy="no-referrer"
                />
              )}
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="text-gray-500 hover:text-gray-900"
              >
                Déconnexion
              </button>
            </>
          ) : (
            <button
              onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
              className="rounded-lg bg-gray-900 px-4 py-1.5 font-medium text-white hover:bg-gray-700"
            >
              Se connecter
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}
