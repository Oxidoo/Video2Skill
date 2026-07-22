import { auth } from "@/auth";

/** Returns the signed-in user's id, or null when unauthenticated. */
export async function currentUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}
