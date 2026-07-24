import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";
import { CONTENT_PAGES } from "@/lib/content";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const contentPages: MetadataRoute.Sitemap = CONTENT_PAGES.map((p) => ({
    url: `${SITE.url}/${p.slug}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  return [
    { url: `${SITE.url}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE.url}/pricing`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    ...contentPages,
  ];
}
