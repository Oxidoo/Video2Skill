import pLimit from "p-limit";
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

// Out of 64 bits. Below this, two frames are "the same screen".
const DIFF_THRESHOLD = 6;
// Scene-change frames get a lower bar rather than a free pass: ffmpeg's scene
// detector fires readily on screencasts (a dropdown opening, a cursor moving
// over a hover state), so exempting them entirely — as the previous version did
// — let near-duplicates through and burned vision budget on them.
const SCENE_DIFF_THRESHOLD = 3;

/** Pick `count` items spread evenly across the list, endpoints included. */
function evenlySpaced<T>(items: T[], count: number): T[] {
  if (count <= 0) return [];
  if (items.length <= count) return items;
  const picked: T[] = [];
  for (let i = 0; i < count; i++) {
    picked.push(items[Math.round((i * (items.length - 1)) / (count - 1))]);
  }
  return [...new Set(picked)];
}

/**
 * Drop near-identical frames, then trim to the vision budget.
 *
 * The budget is passed in (derived from the video's duration) rather than being
 * a flat constant: a flat cap meant a 5-minute clip paid for as many vision
 * calls as an hour-long one while earning a twelfth of the credits.
 */
export async function deduplicateFrames(
  frames: ExtractedFrame[],
  frameBudget: number
): Promise<ExtractedFrame[]> {
  // Hash everything up front in parallel — the comparison below is inherently
  // sequential, but the sharp decode that feeds it is not.
  const limit = pLimit(config.ocrConcurrency);
  const hashes = await Promise.all(
    frames.map((frame) =>
      limit(async () => {
        try {
          return await dhash(frame.file);
        } catch {
          return null; // unreadable frame
        }
      })
    )
  );

  const kept: ExtractedFrame[] = [];
  let lastHash: bigint | null = null;
  for (let i = 0; i < frames.length; i++) {
    const hash = hashes[i];
    if (hash === null) continue;
    const threshold = frames[i].source === "scene" ? SCENE_DIFF_THRESHOLD : DIFF_THRESHOLD;
    if (lastHash === null || hammingDistance(hash, lastHash) >= threshold) {
      kept.push(frames[i]);
      lastHash = hash;
    }
  }

  if (kept.length <= frameBudget) return kept;

  // Over budget: scene changes mark the moments something happened, so they get
  // first claim on the budget; the rest is filled with evenly spread regulars so
  // long static stretches still get coverage.
  const scenes = kept.filter((f) => f.source === "scene");
  const regulars = kept.filter((f) => f.source === "regular");
  const chosenScenes = evenlySpaced(scenes, Math.min(scenes.length, frameBudget));
  const chosenRegulars = evenlySpaced(regulars, frameBudget - chosenScenes.length);

  return [...chosenScenes, ...chosenRegulars]
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(0, frameBudget);
}
