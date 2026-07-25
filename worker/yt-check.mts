/**
 * YouTube ingestion diagnostic.
 *
 *   npm run yt:check -- "https://www.youtube.com/watch?v=..."
 *
 * Reports which of the pieces YouTube downloading depends on are actually
 * present and working, from whatever host it runs on. Written because the
 * failure it diagnoses is environmental — the same code succeeds on a laptop
 * and fails on a CI runner — so the useful question is never "is the code
 * right" but "what does this host see". Run it as a manual Actions job before
 * blaming a job failure on the pipeline.
 *
 * Downloads audio only, so it is cheap and fast even on a long video.
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

import fs from "fs/promises";
import os from "os";
import path from "path";
import { execa } from "execa";
import {
  downloadYoutube,
  normalizeCookieJar,
  YoutubeDownloadError,
} from "../src/lib/youtube-download";
import { normalizeYoutubeUrl } from "../src/lib/youtube";
import { fetchYoutubeInfo } from "../src/lib/youtube";

const OK = "[32m✓[0m";
const NO = "[31m✗[0m";
const WARN = "[33m![0m";

async function version(bin: string, args: string[]): Promise<string | null> {
  try {
    const { stdout, stderr } = await execa(bin, args);
    return (stdout || stderr).split("\n")[0].trim();
  } catch {
    return null;
  }
}

async function main() {
  const url = process.argv[2] ?? "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
  const canonical = normalizeYoutubeUrl(url);

  console.log("=== Environment ===");
  const ytdlp = await version("yt-dlp", ["--version"]);
  const deno = await version("deno", ["--version"]);
  const ffmpeg = await version("ffmpeg", ["-version"]);
  console.log(`${ytdlp ? OK : NO} yt-dlp    ${ytdlp ?? "NOT INSTALLED"}`);
  console.log(
    `${deno ? OK : NO} deno      ${deno ?? "NOT INSTALLED — yt-dlp will fall back to weaker player clients, which YouTube gates hardest"}`
  );
  console.log(`${ffmpeg ? OK : NO} ffmpeg    ${ffmpeg ?? "NOT INSTALLED"}`);

  const proxy = process.env.YTDLP_PROXY?.trim();
  const cookies = process.env.YOUTUBE_COOKIES?.trim();
  const extra = process.env.YTDLP_EXTRA_ARGS?.trim();
  console.log(
    `${proxy ? OK : WARN} proxy     ${proxy ? "configured" : "none (datacenter IPs are commonly bot-checked)"}`
  );

  // Report what the jar parses to, not merely that the variable is set. A jar
  // whose tabs were eaten by a paste, or a JSON export, is silently ignored at
  // download time — that must be visible here rather than at job-failure time.
  if (!cookies) {
    console.log(`${WARN} cookies   none`);
  } else {
    const jar = normalizeCookieJar(cookies);
    if (!jar) {
      console.log(
        `${NO} cookies   set but NOT a Netscape cookie jar — it is being ignored. Export with a "Get cookies.txt" extension and paste the whole file.`
      );
    } else {
      const entries = jar.split("\n").filter((l) => l.includes("\t"));
      const auth = entries.filter((l) => /\b(SID|__Secure-\dPSID)\b/.test(l)).length;
      console.log(
        `${auth > 0 ? OK : WARN} cookies   ${entries.length} cookies parsed, ${auth} session cookie(s)` +
          (auth === 0 ? " — no SID/__Secure-*PSID found, this jar is not signed in" : "")
      );
    }
  }
  if (extra) console.log(`${OK} extra     YTDLP_EXTRA_ARGS=${extra}`);

  if (!canonical) {
    console.error(`\n${NO} "${url}" is not a recognisable YouTube URL.`);
    process.exit(1);
  }

  console.log(`\n=== Metadata scrape (what the web app does) ===`);
  const info = await fetchYoutubeInfo(canonical);
  if (info.durationSec > 0) {
    console.log(`${OK} title "${info.title ?? "?"}" — ${Math.round(info.durationSec)}s`);
  } else {
    console.log(
      `${NO} could not read duration/title. The watch page is being blocked or the video is unavailable.`
    );
  }

  console.log(`\n=== Audio download (what the worker does) ===`);
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "yt-check-"));
  const started = Date.now();
  try {
    const file = await downloadYoutube(canonical, path.join(workDir, "probe"), {
      workDir,
      audioOnly: true,
    });
    const { size } = await fs.stat(file);
    const secs = ((Date.now() - started) / 1000).toFixed(1);
    console.log(
      `${OK} downloaded ${(size / 1024 / 1024).toFixed(1)} MB in ${secs}s -> ${path.basename(file)}`
    );
    console.log("\nYouTube ingestion works from this host.");
  } catch (err) {
    if (err instanceof YoutubeDownloadError) {
      console.log(`${NO} ${err.message}`);
      console.log(`\n--- raw yt-dlp output ---\n${err.detail}`);
      if (err.transient && !proxy && !cookies) {
        console.log(
          "\nNo proxy and no cookies are configured. On a datacenter IP that is the expected outcome — " +
            "set YTDLP_PROXY (residential egress) or YOUTUBE_COOKIES (throwaway account), or rely on file upload."
        );
      }
    } else {
      console.log(`${NO} ${err instanceof Error ? err.message : err}`);
    }
    process.exitCode = 1;
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

main();
