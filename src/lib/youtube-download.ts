import { execa } from "execa";
import fs from "fs/promises";
import path from "path";

/**
 * YouTube downloading from a datacenter IP is an ongoing arms race, not a
 * solved problem. Two failure modes dominate:
 *
 *  1. "No supported JavaScript runtime" — modern yt-dlp needs one (Deno by
 *     default) to decipher YouTube's signatures. Without it yt-dlp silently
 *     falls back to weaker player clients, which are exactly the ones YouTube
 *     gates hardest. Installing Deno is a real fix, not cosmetic.
 *
 *  2. "Sign in to confirm you're not a bot" — YouTube challenges datacenter
 *     ranges (every CI runner, every cloud host). No flag defeats this
 *     reliably; the only durable answer is cookies from a signed-in session,
 *     or an egress IP YouTube doesn't treat as a bot.
 *
 * So: try several player clients (they are gated differently and a rotation
 * genuinely rescues some videos), use cookies when the operator supplied them,
 * and when everything fails, say something the user can act on instead of
 * dumping yt-dlp's stderr into the UI.
 */

/** Player-client rotations, cheapest/most-likely first. */
const CLIENT_STRATEGIES: { label: string; args: string[] }[] = [
  // Whatever yt-dlp considers best, with a JS runtime available.
  { label: "default", args: [] },
  // TV and embedded clients are frequently less gated than the web client.
  { label: "tv", args: ["--extractor-args", "youtube:player_client=tv,tv_embedded"] },
  // Mobile clients, last resort — more formats missing, but sometimes the only
  // ones that answer at all.
  { label: "mobile", args: ["--extractor-args", "youtube:player_client=android,ios"] },
];

export class YoutubeDownloadError extends Error {
  constructor(
    message: string,
    /** True when retrying later, or on another host, could plausibly work. */
    readonly transient: boolean,
    readonly detail: string
  ) {
    super(message);
    this.name = "YoutubeDownloadError";
  }
}

/**
 * Turn yt-dlp's stderr into something a user can act on.
 *
 * The raw output names internal temp paths and player-client internals; it is
 * noise to a customer and it lands in Job.error, which the dashboard shows.
 */
export function classifyYoutubeError(stderr: string): { message: string; transient: boolean } {
  const s = stderr.toLowerCase();

  // Order matters: YouTube opens both the age gate and the bot gate with
  // "Sign in to confirm…", so the specific cases have to be tested first. Match
  // on "not a bot" rather than the prefix, and never on the apostrophe — the
  // real message uses a Unicode right single quote, not an ASCII one.
  if (s.includes("confirm your age") || (s.includes("age") && s.includes("restricted"))) {
    return {
      message: "This video is age-restricted and cannot be downloaded without an account.",
      transient: false,
    };
  }
  if (s.includes("not a bot") || s.includes("confirm youre not") || s.includes("captcha")) {
    return {
      message:
        "YouTube blocked the download from our servers (bot check). This is a limit on YouTube's side, not on your video. Download the video and upload the file directly — that always works.",
      transient: true,
    };
  }
  if (s.includes("private video") || s.includes("members-only") || s.includes("join this channel")) {
    return { message: "This video is private or reserved for members.", transient: false };
  }
  if (s.includes("video unavailable") || s.includes("removed by the uploader")) {
    return { message: "This video is unavailable or has been removed.", transient: false };
  }
  if (s.includes("not available in your country") || s.includes("geo")) {
    return {
      message: "This video is blocked in the region our servers run from.",
      transient: false,
    };
  }
  if (s.includes("is live") || s.includes("live event will begin")) {
    return { message: "Live streams cannot be processed. Wait until the replay is available.", transient: false };
  }
  if (s.includes("timed out") || s.includes("timeout")) {
    return { message: "The download from YouTube timed out.", transient: true };
  }
  return {
    message:
      "Could not download this video from YouTube. Download it yourself and upload the file directly — that always works.",
    transient: true,
  };
}

/**
 * Write operator-supplied cookies to a file yt-dlp can read.
 *
 * Netscape cookie-jar format, supplied out of band via YOUTUBE_COOKIES. Written
 * with owner-only permissions and deleted by the caller with the work dir.
 */
async function writeCookieFile(workDir: string): Promise<string | null> {
  const raw = process.env.YOUTUBE_COOKIES?.trim();
  if (!raw) return null;
  const file = path.join(workDir, "yt-cookies.txt");
  await fs.writeFile(file, raw.endsWith("\n") ? raw : `${raw}\n`, { mode: 0o600 });
  return file;
}

export interface DownloadOptions {
  /** Directory that will hold the cookie file; cleaned up by the caller. */
  workDir: string;
  timeoutMs?: number;
}

/**
 * Download a YouTube video to `${destBase}.mp4`, rotating player clients until
 * one succeeds. Throws YoutubeDownloadError with a user-facing message.
 */
export async function downloadYoutube(
  canonicalUrl: string,
  destBase: string,
  opts: DownloadOptions
): Promise<string> {
  const cookieFile = await writeCookieFile(opts.workDir);
  const timeout = opts.timeoutMs ?? 20 * 60_000;

  const baseArgs = [
    "-f", "bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/b",
    "--no-playlist",
    "--merge-output-format", "mp4",
    // Be a slightly better citizen: a couple of retries and a small delay make
    // transient 403s much less likely to end the job.
    "--retries", "3",
    "--fragment-retries", "3",
    "--sleep-requests", "1",
    "--no-warnings",
    "-o", `${destBase}.%(ext)s`,
    ...(cookieFile ? ["--cookies", cookieFile] : []),
  ];

  let lastStderr = "";
  for (const strategy of CLIENT_STRATEGIES) {
    try {
      await execa("yt-dlp", [...baseArgs, ...strategy.args, canonicalUrl], { timeout });
      if (strategy.label !== "default") {
        console.log(`[yt-dlp] succeeded with player client strategy "${strategy.label}"`);
      }
      return `${destBase}.mp4`;
    } catch (err) {
      const e = err as { stderr?: string; message?: string };
      lastStderr = e.stderr || e.message || String(err);
      const { transient } = classifyYoutubeError(lastStderr);
      console.error(`[yt-dlp] strategy "${strategy.label}" failed: ${lastStderr.slice(0, 300)}`);
      // A permanent condition (private, removed, age-gated) will not be fixed by
      // asking a different player client the same question.
      if (!transient) break;
    }
  }

  const { message, transient } = classifyYoutubeError(lastStderr);
  throw new YoutubeDownloadError(message, transient, lastStderr.slice(0, 2000));
}
