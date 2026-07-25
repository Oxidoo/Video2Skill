import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/SiteFooter";
import { config } from "@/lib/config";
import { prisma } from "@/lib/db";
import { renderMarkdown } from "@/lib/markdown";
import { SITE } from "@/lib/site";

// Published documents are immutable in practice; an hour of caching keeps the
// blob fetch off the request path without making unpublishing slow to take.
export const revalidate = 3600;

async function loadPublished(slug: string) {
  if (!config.publicSkillsEnabled) return null;
  const job = await prisma.job.findFirst({
    where: { publicSlug: slug, isPublic: true, status: "done" },
    select: {
      id: true,
      publicTitle: true,
      publicSummary: true,
      publishedAt: true,
      durationSec: true,
      qualityScore: true,
      skillUrl: true,
      fileName: true,
    },
  });
  if (!job?.skillUrl) return null;

  const upstream = await fetch(job.skillUrl, { next: { revalidate } });
  if (!upstream.ok) return null;
  const markdown = await upstream.text();
  return { job, markdown };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await loadPublished(slug);
  if (!data) return { title: "Skill not found", robots: { index: false, follow: false } };

  const title = data.job.publicTitle ?? data.job.fileName;
  const description =
    data.job.publicSummary ||
    `A step-by-step skill.md extracted from a video: procedures, timestamps and visual cues, grounded in what was actually shown.`;

  return {
    title: `${title} — skill.md`,
    description,
    alternates: { canonical: `/skills/${slug}` },
    openGraph: {
      type: "article",
      url: `${SITE.url}/skills/${slug}`,
      title: `${title} — skill.md`,
      description,
      publishedTime: data.job.publishedAt?.toISOString(),
    },
    twitter: { card: "summary_large_image", title: `${title} — skill.md`, description },
  };
}

function fmtDuration(sec: number | null): string | null {
  if (!sec) return null;
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
}

export default async function PublishedSkillPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await loadPublished(slug);
  if (!data) notFound();

  const { job, markdown } = data;
  const title = job.publicTitle ?? job.fileName;
  const { html, headings } = renderMarkdown(markdown);
  const toc = headings.filter((h) => h.level === 2);
  const duration = fmtDuration(job.durationSec);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "TechArticle",
        headline: `${title} — skill.md`,
        description: job.publicSummary ?? undefined,
        url: `${SITE.url}/skills/${slug}`,
        datePublished: job.publishedAt?.toISOString(),
        inLanguage: "en-US",
        isPartOf: { "@id": `${SITE.url}/#website` },
        publisher: { "@type": "Organization", name: SITE.name, url: SITE.url },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: SITE.url },
          { "@type": "ListItem", position: 2, name: "Skills", item: `${SITE.url}/skills` },
          { "@type": "ListItem", position: 3, name: title, item: `${SITE.url}/skills/${slug}` },
        ],
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <nav className="mb-6 text-sm text-gray-500">
          <Link href="/skills" className="hover:text-gray-900">
            Skills
          </Link>
          <span className="mx-2">/</span>
          <span className="text-gray-700">{title}</span>
        </nav>

        <div className="mb-8 flex flex-wrap items-center gap-3 text-sm">
          {duration && (
            <span className="rounded-full bg-gray-100 px-3 py-1 text-gray-600">
              Source video: {duration}
            </span>
          )}
          {job.qualityScore !== null && (
            <span className="rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-700">
              Quality score {job.qualityScore}/100
            </span>
          )}
        </div>

        <div className="grid gap-10 lg:grid-cols-[1fr_220px]">
          <article
            className="min-w-0"
            dangerouslySetInnerHTML={{ __html: html }}
          />

          {toc.length > 1 && (
            <aside className="hidden lg:block">
              <div className="sticky top-20">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  On this page
                </p>
                <ul className="space-y-2 text-sm">
                  {toc.map((h) => (
                    <li key={h.id}>
                      <a href={`#${h.id}`} className="text-gray-600 hover:text-gray-900">
                        {h.text}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </aside>
          )}
        </div>

        <section className="mt-14 rounded-2xl border border-blue-200 bg-blue-50 p-6">
          <h2 className="text-xl font-bold text-gray-900">
            This file was generated from a video, automatically
          </h2>
          <p className="mt-2 text-gray-700">
            Video2Skill combined a timestamped transcript, OCR of every on-screen label and a visual
            analysis of each key frame, then audited the result against that evidence. Do the same
            with your own video.
          </p>
          <div className="mt-5">
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
            >
              Generate your own skill.md
            </Link>
          </div>
        </section>

        <p className="mt-8 text-xs leading-relaxed text-gray-400">
          Published by a Video2Skill user, who confirmed they hold the rights to share this
          material. AI-generated from a video and may contain errors — verify anything marked
          uncertain before acting on it. To request removal, contact us with this page&apos;s URL.
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
