const ID_PATTERNS = [
  /youtu\.be\/([\w-]{11})/,
  /youtube\.com\/watch\?v=([\w-]{11})/,
  /youtube\.com\/shorts\/([\w-]{11})/,
  /youtube\.com\/live\/([\w-]{11})/,
  /youtube\.com\/embed\/([\w-]{11})/,
];

export function isYoutubeUrl(url: string): boolean {
  return ID_PATTERNS.some((p) => p.test(url.trim()));
}

/** Canonical watch URL, or null if the string isn't a recognizable YouTube link. */
export function normalizeYoutubeUrl(url: string): string | null {
  const u = url.trim();
  for (const p of ID_PATTERNS) {
    const m = u.match(p);
    if (m) return `https://www.youtube.com/watch?v=${m[1]}`;
  }
  return null;
}

function decodeBasic(s: string): string {
  return s
    .replace(/\\u0026/g, "&")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\\"/g, '"');
}

export interface YoutubeInfo {
  durationSec: number;
  title: string | null;
}

/** Best-effort duration + title by scraping the watch page (no API key needed). */
export async function fetchYoutubeInfo(url: string): Promise<YoutubeInfo> {
  const canonical = normalizeYoutubeUrl(url);
  if (!canonical) return { durationSec: 0, title: null };
  try {
    const res = await fetch(canonical, {
      headers: { "User-Agent": "Mozilla/5.0", "Accept-Language": "en-US,en;q=0.9" },
    });
    const html = await res.text();
    const dur = html.match(/"lengthSeconds":"(\d+)"/);
    const title =
      html.match(/"title":"([^"]{1,200})"/) ?? html.match(/<title>([^<]{1,200})<\/title>/);
    return {
      durationSec: dur ? Number(dur[1]) : 0,
      title: title ? decodeBasic(title[1]).replace(/ - YouTube$/, "").trim() : null,
    };
  } catch {
    return { durationSec: 0, title: null };
  }
}
