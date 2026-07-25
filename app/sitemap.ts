import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";
import { CONTENT_PAGES } from "@/lib/content";
import { config } from "@/lib/config";
import { prisma } from "@/lib/db";

// Rebuilt periodically so newly published skills get indexed without a deploy.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const contentPages: MetadataRoute.Sitemap = CONTENT_PAGES.map((p) => ({
    url: `${SITE.url}/${p.slug}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  // Every published skill is its own long-tail landing page — that is the point
  // of letting users publish, so they belong in the sitemap.
  let skillPages: MetadataRoute.Sitemap = [];
  if (config.publicSkillsEnabled) {
    try {
      const published = await prisma.job.findMany({
        where: { isPublic: true, status: "done" },
        orderBy: { publishedAt: "desc" },
        take: 5000,
        select: { publicSlug: true, publishedAt: true },
      });
      skillPages = published.flatMap((s) =>
        s.publicSlug
          ? [
              {
                url: `${SITE.url}/skills/${s.publicSlug}`,
                lastModified: s.publishedAt ?? now,
                changeFrequency: "monthly" as const,
                priority: 0.6,
              },
            ]
          : []
      );
    } catch {
      // A database hiccup must not break the sitemap for the static pages.
      skillPages = [];
    }
  }

  return [
    { url: `${SITE.url}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    {
      url: `${SITE.url}/free-youtube-transcript`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    { url: `${SITE.url}/pricing`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE.url}/skills`, lastModified: now, changeFrequency: "daily", priority: 0.7 },
    ...contentPages,
    ...skillPages,
  ];
}
