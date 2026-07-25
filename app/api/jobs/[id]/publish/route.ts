import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { prisma } from "@/lib/db";
import { allocateSlug, skillTitle, summarize } from "@/lib/publish";
import { currentUserId } from "@/lib/session";

export const runtime = "nodejs";

/**
 * Publish a finished skill.md to a public, indexable page.
 *
 * Opt-in and owner-only. The caller must assert they hold the rights to share
 * the source material — this endpoint publishes a derivative of someone's video
 * to the open web, so consent is recorded rather than assumed.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!config.publicSkillsEnabled) {
    return NextResponse.json({ error: "Publishing is disabled." }, { status: 403 });
  }

  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  let body: { confirmRights?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    // Body is optional beyond the rights flag, which we validate next.
  }
  if (body.confirmRights !== true) {
    return NextResponse.json(
      { error: "You must confirm you have the right to share this video's content." },
      { status: 400 }
    );
  }

  const job = await prisma.job.findFirst({
    where: { id, userId },
    select: {
      id: true,
      fileName: true,
      status: true,
      skillUrl: true,
      options: true,
      isPublic: true,
      publicSlug: true,
    },
  });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  if (job.status !== "done" || !job.skillUrl) {
    return NextResponse.json({ error: "Job is not finished." }, { status: 409 });
  }
  const outputType = (job.options as { outputType?: string } | null)?.outputType ?? "skill";
  if (outputType !== "skill") {
    // Transcripts are a near-verbatim copy of someone else's video. Publishing
    // one is a republication of the source; a skill.md is a derived procedure.
    return NextResponse.json(
      { error: "Only skill.md outputs can be published." },
      { status: 400 }
    );
  }

  if (job.isPublic && job.publicSlug) {
    return NextResponse.json({ slug: job.publicSlug, url: `/skills/${job.publicSlug}` });
  }

  const upstream = await fetch(job.skillUrl);
  if (!upstream.ok) {
    return NextResponse.json({ error: "Could not read the generated file." }, { status: 502 });
  }
  const markdown = await upstream.text();

  const title = skillTitle(markdown, job.fileName);
  const slug = job.publicSlug ?? (await allocateSlug(title));

  await prisma.job.update({
    where: { id: job.id },
    data: {
      isPublic: true,
      publicSlug: slug,
      publicTitle: title.slice(0, 200),
      publicSummary: summarize(markdown),
      publishedAt: new Date(),
    },
  });

  return NextResponse.json({ slug, url: `/skills/${slug}` });
}

/** Unpublish. The slug is kept so re-publishing reuses the same URL. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const result = await prisma.job.updateMany({
    where: { id, userId },
    data: { isPublic: false, publishedAt: null },
  });
  if (result.count === 0) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  return NextResponse.json({ ok: true });
}
