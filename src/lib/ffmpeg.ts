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

export async function probeVideo(videoPath: string): Promise<VideoMeta> {
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
  if (!video) throw new Error("No video stream found — file unreadable or not a video.");

  const [num, den] = String(video.r_frame_rate ?? "0/1").split("/").map(Number);
  return {
    durationSec: Number(info.format?.duration ?? 0),
    width: Number(video.width ?? 0),
    height: Number(video.height ?? 0),
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

/** ffmpeg args that turn the input's audio into transcription-ready chunks. */
function audioOutputArgs(audioDir: string): string[] {
  const codec = config.audioCodec === "wav" ? "wav" : "flac";
  // FLAC is lossless and roughly a quarter the size of 16 kHz mono WAV, which
  // kept 10-minute chunks uncomfortably close to the 25 MB upload limit.
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

async function listAudioChunks(audioDir: string): Promise<string[]> {
  const ext = config.audioCodec === "wav" ? ".wav" : ".flac";
  const files = (await fs.readdir(audioDir))
    .filter((f) => f.startsWith("chunk_") && f.endsWith(ext))
    .sort()
    .map((f) => path.join(audioDir, f));
  if (files.length === 0) throw new Error("Audio extraction produced no chunks.");
  return files;
}

/**
 * Audio only — used by transcript-only jobs, which never look at frames.
 * One decode, straight from the video into segmented chunks (the old path
 * decoded once to a full WAV and then re-read that WAV to segment it).
 */
export async function extractAudio(videoPath: string, audioDir: string): Promise<string[]> {
  await execa("ffmpeg", ["-y", "-i", videoPath, ...audioOutputArgs(audioDir)], {
    timeout: config.ffmpegTimeoutMs,
  });
  return listAudioChunks(audioDir);
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

  const args = [
    "-y",
    "-i", videoPath,
    ...audioOutputArgs(audioDir),
    ...frameOutputArgs(framesDir, "regular", `fps=1/${interval.toFixed(3)}`),
    ...frameOutputArgs(
      framesDir,
      "scene",
      `select='gt(scene,${config.sceneThreshold})'`
    ),
  ];

  try {
    await execa("ffmpeg", args, { timeout: config.ffmpegTimeoutMs });
  } catch (err) {
    // Scene detection is the fragile half (some codecs refuse it). Retry without
    // it rather than losing the whole job — regular frames still cover the video.
    const fallback = [
      "-y",
      "-i", videoPath,
      ...audioOutputArgs(audioDir),
      ...frameOutputArgs(framesDir, "regular", `fps=1/${interval.toFixed(3)}`),
    ];
    try {
      await execa("ffmpeg", fallback, { timeout: config.ffmpegTimeoutMs });
    } catch {
      throw err instanceof Error ? err : new Error(String(err));
    }
  }

  const [audioChunks, frames] = await Promise.all([
    listAudioChunks(audioDir),
    collectFrames(framesDir, durationSec, interval),
  ]);
  return { audioChunks, frames, interval };
}
