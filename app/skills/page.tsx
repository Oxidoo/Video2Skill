import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { config } from "@/lib/config";
import { prisma } from "@/lib/db";
import { SITE } from "@/lib/site";

export const revalidate = 1800;

const TITLE = "Skill library — step-by-step procedures extracted from videos";
const DESCRIPTION =
  "Public skill.md files generated from real videos: numbered procedures, source timestamps and visual cues, grounded in what was actually shown on screen.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/skills" },
  openGraph: { type: "website", url: `${SITE.url}/skills`, title: TITLE, description: DESCRIPTION },
};

type SkillCard = {
  publicSlug: string | null;
  publicTitle: string | null;
  publicSummary: string | null;
  qualityScore: number | null;
};

/**
 * The library is rendered at build time and revalidated, so a database that is
 * briefly unreachable must degrade to an empty list rather than fail the whole
 * deploy.
 */
async function loadSkills(): Promise<SkillCard[]> {
  if (!config.publicSkillsEnabled) return [];
  try {
    return await prisma.job.findMany({
      where: { isPublic: true, status: "done" },
      orderBy: { publishedAt: "desc" },
      take: 100,
      select: {
        publicSlug: true,
        publicTitle: true,
        publicSummary: true,
        qualityScore: true,
      },
    });
  } catch {
    return [];
  }
}

export default async function SkillsIndexPage() {
  const skills = await loadSkills();

  return (
    <>
      <main className="mx-auto max-w-4xl px-6 py-12">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900">Skill library</h1>
        <p className="mt-4 max-w-2xl text-lg text-gray-600">
          Procedures extracted from real videos and shared by their authors. Every step is tied to a
          source timestamp and to something that was actually visible on screen.
        </p>

        {skills.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-dashed border-gray-300 p-10 text-center">
            <p className="text-gray-600">No public skills yet.</p>
            <Link
              href="/"
              className="mt-4 inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
            >
              Publish the first one
            </Link>
          </div>
        ) : (
          <ul className="mt-10 grid gap-4 sm:grid-cols-2">
            {skills.map((s) => (
              <li key={s.publicSlug}>
                <Link
                  href={`/skills/${s.publicSlug}`}
                  className="block h-full rounded-2xl border border-gray-200 bg-white p-5 transition hover:border-blue-300 hover:shadow-sm"
                >
                  <h2 className="font-semibold text-gray-900">{s.publicTitle}</h2>
                  {s.publicSummary && (
                    <p className="mt-2 line-clamp-3 text-sm text-gray-600">{s.publicSummary}</p>
                  )}
                  {s.qualityScore !== null && (
                    <span className="mt-3 inline-block rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                      Quality {s.qualityScore}/100
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
