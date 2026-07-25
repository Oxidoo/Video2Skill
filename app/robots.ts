import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      // /skills is the public library and must stay crawlable; /dashboard and
      // the API are per-user surfaces with nothing to index.
      allow: ["/", "/skills"],
      disallow: ["/api/", "/dashboard"],
    },
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  };
}
