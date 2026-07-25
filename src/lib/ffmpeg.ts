import { execa } from "execa";
import fs from "fs/promises";
import path from "path";
import { config } from "./config";

export interface VideoMeta {
  durationSec: number;
  width: number;
  height: number;
  fps: number;
  hasAudio: boolean;
  sizeBytes: number;
}

export interface ExtractedFrame {
  file: string;
  timestamp: number;
  source: "regular" | "scene";
}

export async function probeVideo(
  videoPath: string,
  opts: { requireVideo?: boolean } = {}
): Promise<VideoMeta> {
  const { stdout } = await execa(
    "ffprobe",
    [
      "-v", "error",
      "-show_entries", "format=duration,size",
      "-show_entries", "stream=codec_type,width,height,r_frame_rate",
      "-of", "json",
      videoPath,
    ],
    { timeout: config.ffmpegTimeoutMs }
  );
  const info = JSON.parse(stdout);
  const video = info.streams?.find((s: { codec_type: string }) => s.codec_type === "video");
  const audio = info.streams?.find((s: { codec_type: string }) => s.codec_type === "audio");

  // Transcript-only jobs are fed an audio-only download on purpose, so a
  // missing video stream is expected there rather than a corrupt file.
  const requireVideo = opts.requireVideo ?? true;
  if (requireVideo && !video) {
    throw new Error("No video stream found — file unreadable or not a video.");
  }
  if (!audio && !video) {
    throw new Error("File contains no audio or video stream — unreadable download.");
  }

  const [num, den] = String(video?.r_frame_rate ?? "0/1").split("/").map(Number);
  return {
    durationSec: Number(info.format?.duration ?? 0),
    width: Number(video?.width ?? 0),
    height: Number(video?.height ?? 0),
    fps: den ? num / den : 0,
    hasAudio: Boolean(audio),
    sizeBytes: Number(info.format?.size ?? 0),
  };
}

/**
 * Seconds between sampled frames. Derived from the vision budget rather than
 * fixed: at a hardcoded 1-per-5s a 2-hour video produced ~1440 stills, every
 * one of them hashed by sharp, to keep at most 60. Oversampling by a small
 * factor leaves deduplication a real choice without extracting the world.
 */
export function frameInterval(durationSec: number, frameBudget: number): number {
  const candidates = Math.max(1, frameBudget * config.frameOversample);
  return Math.max(config.frameIntervalSec, durationSec / candidates);
}

export type AudioCodec = "flac" | "wav";

/**
 * Codecs to try, in order. FLAC is lossless and roughly a quarter the size of
 * 16 kHz mono WAV, which kept 10-minute chunks uncomfortably close to the 25 MB
 * transcription upload limit — but the segment muxer's behaviour varies across
 * ffmpeg builds, so WAV stays as a fallback rather than failing the job.
 */
function audioCodecCandidates(): AudioCodec[] {
  return config.audioCodec === "wav" ? ["wav"] : ["flac", "wav"];
}

/** ffmpeg args that turn the input's audio into transcription-ready chunks. */
function audioOutputArgs(audioDir: string, codec: AudioCodec): string[] {
  return [
    "-vn",
    "-ac", "1",
    "-ar", "16000",
    "-c:a", codec === "wav" ? "pcm_s16le" : "flac",
    "-f", "segment",
    "-segment_time", String(config.audioChunkSec),
    "-segment_format", codec,
    "-reset_timestamps", "1",
    path.join(audioDir, `chunk_%03d.${codec}`),
  ];
}

/** Remove partial output from a failed attempt so the retry starts clean. */
async function clearDir(dir: string): Promise<void> {
  const files = await fs.readdir(dir).catch(() => [] as string[]);
  await Promise.all(files.map((f) => fs.rm(path.join(dir, f), { force: true }).catch(() => {})));
}

/**
 * ffmpeg args for one sampled-frame output. `metadata=print` writes the exact
 * presentation timestamp of every emitted frame to its own sidecar file, which
 * is how both outputs can run in the same command without their timestamps
 * interleaving on stderr — and it fixes regular-frame timestamps, which used to
 * be inferred as `(n-1) * interval` and drifted on variable-frame-rate sources.
 */
function frameOutputArgs(
  framesDir: string,
  prefix: "regular" | "scene",
  filter: string
): string[] {
  return [
    "-an",
    "-vf", `${filter},metadata=print:file=${path.join(framesDir, `${prefix}.times`)}`,
    "-vsync", "vfr",
    "-q:v", "2",
    path.join(framesDir, `${prefix}_%06d.jpg`),
  ];
}

async function readFrameTimes(framesDir: string, prefix: string): Promise<number[]> {
  try {
    const raw = await fs.readFile(path.join(framesDir, `${prefix}.times`), "utf8");
    return [...raw.matchAll(/pts_time:([\d.]+)/g)].map((m) => parseFloat(m[1]));
  } catch {
    return [];
  }
}

async function collectFrames(
  framesDir: string,
  durationSec: number,
  interval: number
): Promise<ExtractedFrame[]> {
  const [regularTimes, sceneTimes] = await Promise.all([
    readFrameTimes(framesDir, "regular"),
    readFrameTimes(framesDir, "scene"),
  ]);
  const files = (await fs.readdir(framesDir)).sort();

  const frames: ExtractedFrame[] = [];
  let regularIdx = 0;
  let sceneIdx = 0;
  for (const f of files) {
    if (!f.endsWith(".jpg")) continue;
    const full = path.join(framesDir, f);

    if (f.startsWith("regular_")) {
      const n = regularIdx++;
      const ts = regularTimes[n];
      // If the sidecar is missing or short, fall back to the nominal sampling
      // grid. Defaulting to 0 instead would pile every frame onto the start of
      // the timeline, which is far worse than a slightly imprecise timestamp.
      const resolved = Number.isFinite(ts) ? ts : n * interval;
      frames.push({
        file: full,
        timestamp: Math.min(Math.max(resolved, 0), durationSec),
        source: "regular",
      });
      continue;
    }

    if (f.startsWith("scene_")) {
      const ts = sceneTimes[sceneIdx++];
      // Scene frames have no nominal grid to fall back to, so an unknown
      // timestamp makes the frame unusable — drop it rather than misplace it.
      if (!Number.isFinite(ts)) continue;
      frames.push({
        file: full,
        timestamp: Math.min(Math.max(ts, 0), durationSec),
        source: "scene",
      });
    }
  }
  return frames.sort((a, b) => a.timestamp - b.timestamp);
}

async function listAudioChunks(audioDir: string, codec: AudioCodec): Promise<string[]> {
  const files = (await fs.readdir(audioDir))
    .filter((f) => f.startsWith("chunk_") && f.endsWith(`.${codec}`))
    .sort()
    .map((f) => path.join(audioDir, f));
  if (files.length === 0) throw new Error("Audio extraction produced no chunks.");
  return files;
}

/**
 * Run one ffmpeg invocation per candidate audio codec until one produces
 * chunks. `extraOutputs` lets the caller attach the frame outputs to the same
 * decode. Returns the chunk paths.
 */
async function runExtraction(
  videoPath: string,
  audioDir: string,
  extraOutputs: string[]
): Promise<string[]> {
  let lastError: unknown;
  for (const codec of audioCodecCandidates()) {
    try {
      await execa(
        "ffmpeg",
        ["-y", "-i", videoPath, ...audioOutputArgs(audioDir, codec), ...extraOutputs],
        { timeout: config.ffmpegTimeoutMs }
      );
      return await listAudioChunks(audioDir, codec);
    } catch (err) {
      lastError = err;
      console.error(
        `[ffmpeg] ${codec} extraction failed:`,
        err instanceof Error ? err.message : err
      );
      await clearDir(audioDir);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Audio extraction failed.");
}

/**
 * Audio only — used by transcript-only jobs, which never look at frames.
 * One decode, straight from the video into segmented chunks (the old path
 * decoded once to a full WAV and then re-read that WAV to segment it).
 */
export async function extractAudio(videoPath: string, audioDir: string): Promise<string[]> {
  return runExtraction(videoPath, audioDir, []);
}

/**
 * Audio chunks + sampled frames + scene-change frames from a SINGLE decode.
 *
 * The previous pipeline decoded the video four times: once for the full WAV,
 * once to segment it, once for regular frames and once for scene detection.
 * ffmpeg happily feeds several outputs from one decode, and decoding is the
 * expensive part.
 */
export async function extractMedia(
  videoPath: string,
  audioDir: string,
  framesDir: string,
  durationSec: number,
  frameBudget: number
): Promise<{ audioChunks: string[]; frames: ExtractedFrame[]; interval: number }> {
  const interval = frameInterval(durationSec, frameBudget);
  const regularOutput = frameOutputArgs(framesDir, "regular", `fps=1/${interval.toFixed(3)}`);
  const sceneOutput = frameOutputArgs(
    framesDir,
    "scene",
    `select='gt(scene,${config.sceneThreshold})'`
  );

  let audioChunks: string[];
  try {
    audioChunks = await runExtraction(videoPath, audioDir, [...regularOutput, ...sceneOutput]);
  } catch (err) {
    // Scene detection is the fragile half (some codecs refuse it). Retry without
    // it rather than losing the whole job — regular frames still cover the video.
    console.error(
      "[ffmpeg] retrying without scene detection:",
      err instanceof Error ? err.message : err
    );
    await clearDir(framesDir);
    audioChunks = await runExtraction(videoPath, audioDir, regularOutput);
  }

  const frames = await collectFrames(framesDir, durationSec, interval);
  return { audioChunks, frames, interval };
}
