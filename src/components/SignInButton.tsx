"use client";

import { signIn } from "next-auth/react";

export function SignInButton({
  callbackUrl = "/dashboard",
  className,
  children,
}: {
  callbackUrl?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <button
      onClick={() => signIn("google", { callbackUrl })}
      className={
        className ??
        "inline-flex items-center justify-center gap-2 rounded-lg bg-gray-900 px-5 py-2.5 font-medium text-white transition-colors hover:bg-gray-700"
      }
    >
      {children ?? "Se connecter avec Google"}
    </button>
  );
}
