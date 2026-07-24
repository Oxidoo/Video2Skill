import { NextRequest, NextResponse } from "next/server";
import { currentUserId } from "@/lib/session";
import { normalizeYoutubeUrl, fetchYoutubeInfo } from "@/lib/youtube";

export const runtime = "nodejs";

// Duration + title for a YouTube URL, used to preview the credit cost before
// creating a job.
export async function GET(req: NextRequest) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = req.nextUrl.searchParams.get("url") ?? "";
  const canonical = normalizeYoutubeUrl(url);
  if (!canonical) return NextResponse.json({ error: "Invalid YouTube URL" }, { status: 400 });

  const info = await fetchYoutubeInfo(canonical);
  return NextResponse.json({ url: canonical, durationSec: info.durationSec, title: info.title });
}
