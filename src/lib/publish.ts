import { randomBytes } from "crypto";
import { prisma } from "./db";
import { firstParagraph } from "./markdown";

/** URL-safe slug body from arbitrary text. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");
}

/** The document's H1, minus the "Skill — " prefix the generator adds. */
export function skillTitle(markdown: string, fallback: string): string {
  const h1 = markdown.match(/^#\s+(.+)$/m);
  const raw = h1?.[1]?.trim();
  if (!raw) return fallback;
  return raw.replace(/^skill\s*[—–-]\s*/i, "").trim() || fallback;
}

/**
 * Allocate a unique public slug. The random suffix keeps two videos about the
 * same subject from colliding, and stops slugs from being guessable enough to
 * enumerate what other people have published.
 */
export async function allocateSlug(title: string): Promise<string> {
  const base = slugify(title) || "skill";
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = `${base}-${randomBytes(3).toString("hex")}`;
    const clash = await prisma.job.findUnique({ where: { publicSlug: slug }, select: { id: true } });
    if (!clash) return slug;
  }
  return `${base}-${randomBytes(8).toString("hex")}`;
}

export function summarize(markdown: string): string {
  return firstParagraph(markdown, 280);
}
