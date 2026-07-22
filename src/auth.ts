import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db";
import { SIGNUP_BONUS_CREDITS } from "@/lib/billing";
import { recordCredit } from "@/lib/credits";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database" },
  trustHost: true,
  providers: [Google],
  pages: { signIn: "/" },
  callbacks: {
    session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        // credits/isAdmin live on the adapter's user row.
        const u = user as unknown as { credits?: number; isAdmin?: boolean };
        session.user.credits = u.credits ?? 0;
        session.user.isAdmin = u.isAdmin ?? false;
      }
      return session;
    },
  },
  events: {
    // Grant welcome credits the first time a Google account signs in.
    async createUser({ user }) {
      if (SIGNUP_BONUS_CREDITS > 0 && user.id) {
        await recordCredit(prisma, {
          userId: user.id,
          amount: SIGNUP_BONUS_CREDITS,
          type: "signup_bonus",
          description: "Crédits de bienvenue",
        });
      }
    },
  },
});
