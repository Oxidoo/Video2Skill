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

export async function probeVideo(videoPath: string): Promise<VideoMeta> {
  const { stdout } = await execa("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration,size",
    "-show_entries", "stream=codec_type,width,height,r_frame_rate",
    "-of", "json",
    videoPath,
  ]);
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

export async function extractAudio(videoPath: string, audioDir: string): Promise<string[]> {
  const fullWav = path.join(audioDir, "full.wav");
  await execa("ffmpeg", ["-y", "-i", videoPath, "-vn", "-ac", "1", "-ar", "16000", fullWav]);
  // Segment so each chunk stays well under transcription upload limits (25 MB).
  await execa("ffmpeg", [
    "-y", "-i", fullWav,
    "-f", "segment",
    "-segment_time", String(config.audioChunkSec),
    "-c", "copy",
    path.join(audioDir, "chunk_%03d.wav"),
  ]);
  const files = (await fs.readdir(audioDir))
    .filter((f) => f.startsWith("chunk_") && f.endsWith(".wav"))
    .sort()
    .map((f) => path.join(audioDir, f));
  if (files.length === 0) throw new Error("Audio extraction produced no chunks.");
  return files;
}

export interface ExtractedFrame {
  file: string;
  timestamp: number;
  source: "regular" | "scene";
}

export async function extractFrames(
  videoPath: string,
  framesDir: string,
  durationSec: number
): Promise<ExtractedFrame[]> {
  const interval = config.frameIntervalSec;

  // Regular frames every N seconds — timestamps are deterministic.
  await execa("ffmpeg", [
    "-y", "-i", videoPath,
    "-vf", `fps=1/${interval}`,
    path.join(framesDir, "regular_%06d.png"),
  ]);

  // Scene-change frames — recover timestamps from showinfo output (pts_time).
  const sceneTimes: number[] = [];
  try {
    const { stderr } = await execa("ffmpeg", [
      "-y", "-i", videoPath,
      "-vf", `select='gt(scene,${config.sceneThreshold})',showinfo`,
      "-vsync", "vfr",
      path.join(framesDir, "scene_%06d.png"),
    ]);
    for (const match of stderr.matchAll(/pts_time:([\d.]+)/g)) {
      sceneTimes.push(parseFloat(match[1]));
    }
  } catch {
    // Scene detection is best-effort; regular frames still cover the video.
  }

  const frames: ExtractedFrame[] = [];
  const files = (await fs.readdir(framesDir)).sort();
  let sceneIdx = 0;
  for (const f of files) {
    const full = path.join(framesDir, f);
    if (f.startsWith("regular_")) {
      const n = parseInt(f.slice("regular_".length, -".png".length), 10);
      // fps=1/N emits the first frame near t=0, then every N seconds.
      const ts = Math.min((n - 1) * interval, durationSec);
      frames.push({ file: full, timestamp: ts, source: "regular" });
    } else if (f.startsWith("scene_")) {
      frames.push({ file: full, timestamp: sceneTimes[sceneIdx++] ?? 0, source: "scene" });
    }
  }
  return frames.sort((a, b) => a.timestamp - b.timestamp);
}
