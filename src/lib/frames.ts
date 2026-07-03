import sharp from "sharp";
import { ExtractedFrame } from "./ffmpeg";
import { config } from "./config";

/**
 * Perceptual dHash (difference hash) on a 9x8 grayscale thumbnail.
 * Cheap and robust enough to drop near-identical consecutive frames.
 */
async function dhash(file: string): Promise<bigint> {
  const { data } = await sharp(file)
    .grayscale()
    .resize(9, 8, { fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  let hash = 0n;
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      hash = (hash << 1n) | (data[row * 9 + col] > data[row * 9 + col + 1] ? 1n : 0n);
    }
  }
  return hash;
}

function hammingDistance(a: bigint, b: bigint): number {
  let x = a ^ b;
  let count = 0;
  while (x) {
    count += Number(x & 1n);
    x >>= 1n;
  }
  return count;
}

const DIFF_THRESHOLD = 6; // out of 64 bits — below this, frames are "the same screen"

export async function deduplicateFrames(frames: ExtractedFrame[]): Promise<ExtractedFrame[]> {
  const kept: ExtractedFrame[] = [];
  let lastHash: bigint | null = null;

  for (const frame of frames) {
    let hash: bigint;
    try {
      hash = await dhash(frame.file);
    } catch {
      continue; // unreadable frame, skip
    }
    const isSceneChange = frame.source === "scene";
    if (lastHash === null || isSceneChange || hammingDistance(hash, lastHash) >= DIFF_THRESHOLD) {
      kept.push(frame);
      lastHash = hash;
    }
  }

  // Hard cap to keep vision cost bounded: keep evenly spaced subset, scene frames first.
  if (kept.length > config.maxVisionFrames) {
    const scenes = kept.filter((f) => f.source === "scene");
    const regulars = kept.filter((f) => f.source === "regular");
    const budget = Math.max(config.maxVisionFrames - scenes.length, 0);
    const step = Math.ceil(regulars.length / Math.max(budget, 1));
    const sampled = budget > 0 ? regulars.filter((_, i) => i % step === 0) : [];
    return [...scenes, ...sampled]
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(0, config.maxVisionFrames);
  }
  return kept;
}
