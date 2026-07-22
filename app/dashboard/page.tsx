import { auth } from "@/auth";
import { Studio } from "@/components/Studio";
import { JobHistory } from "@/components/JobHistory";
import { SignInButton } from "@/components/SignInButton";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    return (
      <main className="mx-auto max-w-md px-6 py-24 text-center">
        <h1 className="text-2xl font-bold text-gray-900">Connecte-toi pour commencer</h1>
        <p className="mt-2 text-gray-500">
          Accède au studio et transforme tes vidéos de formation en skill.md.
        </p>
        <div className="mt-6 flex justify-center">
          <SignInButton />
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 px-6 py-12">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Studio</h1>
        <p className="mt-1 text-gray-500">
          Dépose une formation vidéo et génère un skill.md exploitable par une IA.
        </p>
      </header>
      <Studio />
      <JobHistory />
    </main>
  );
}
