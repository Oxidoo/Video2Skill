import type { DefaultSession } from "next-auth";

// Augment the session so `session.user.id`, `.credits` and `.isAdmin` are typed
// everywhere we call `auth()`.
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      credits: number;
      isAdmin: boolean;
    } & DefaultSession["user"];
  }
}
