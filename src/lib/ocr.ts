import { execa } from "execa";
import pLimit from "p-limit";
import path from "path";
import sharp from "sharp";
import { config } from "./config";
import { ExtractedFrame } from "./ffmpeg";
import { OcrResult } from "./schemas";

/**
 * Tesseract is built with OpenMP and, left alone, spawns roughly one thread per
 * core *per process*. Running several in parallel therefore oversubscribes the
 * machine by the square of the concurrency — four processes on four cores means
 * sixteen threads fighting for four cores — and they thrash badly enough that
 * every one of them blows past the timeout and returns nothing.
 *
 * Measured on a 4-core runner, 8 frames: 50s and 1/8 succeeding without this,
 * 0.4s and 8/8 with it. The parallelism belongs at the process level, where
 * p-limit already manages it, not inside each process.
 */
const OCR_ENV = { ...process.env, OMP_THREAD_LIMIT: "1" };

/**
 * Prepare a frame for Tesseract.
 *
 * Downscaling helps; converting to grayscale and stretching contrast does not.
 * Measured against a screencast frame, `grayscale().normalize()` dropped
 * recognised UI labels from 9/10 to 6/10 — contrast stretching crushes the
 * anti-aliased edges that make small UI text legible in the first place. So the
 * only transform left is the resize.
 */
async function prepareForOcr(file: string): Promise<Buffer> {
  return sharp(file)
    .resize({ width: config.ocrImageWidth, withoutEnlargement: true })
    .png()
    .toBuffer();
}

/**
 * OCR every frame.
 *
 * `onProgress` matters for more than the UI: the OCR stage can run without
 * touching the database, and the worker re-queues any job whose row has gone
 * quiet — which meant a still-running job could be picked up again and the
 * whole AI bill paid twice.
 */
export async function runOcr(
  frames: ExtractedFrame[],
  onProgress?: (done: number, total: number) => Promise<void>
): Promise<OcrResult[]> {
  const limit = pLimit(Math.max(1, config.ocrConcurrency));
  let done = 0;
  let failures = 0;
  let firstError = "";

  const results = await Promise.all(
    frames.map((frame) =>
      limit(async (): Promise<OcrResult> => {
        const base = { frame: path.basename(frame.file), timestamp: frame.timestamp };
        try {
          const image = await prepareForOcr(frame.file);
          // `--psm 11` (sparse text) rather than `6` (one uniform block): a UI
          // screenshot is scattered labels, not a paragraph, and psm 6 misses
          // isolated button captions — the single most useful thing OCR can
          // corroborate here.
          const { stdout } = await execa(
            "tesseract",
            ["stdin", "stdout", "-l", config.ocrLangs, "--psm", config.ocrPsm],
            { input: image, timeout: config.ocrTimeoutMs, env: OCR_ENV }
          );
          return { ...base, ocrText: stdout.replace(/\s+/g, " ").trim() };
        } catch (err) {
          failures++;
          if (!firstError) firstError = err instanceof Error ? err.message : String(err);
          return { ...base, ocrText: "" };
        } finally {
          done++;
          if (onProgress) await onProgress(done, frames.length);
        }
      })
    )
  );

  // OCR failing is survivable — the vision pass still reads the screen — but it
  // silently removes one of the three grounding sources, so it must not pass
  // unremarked. Whole-stage failure usually means tesseract is missing or the
  // language pack is not installed.
  if (failures > 0) {
    console.error(
      `[ocr] ${failures}/${frames.length} frames failed (langs="${config.ocrLangs}"): ${firstError.slice(0, 200)}`
    );
  }
  const empty = results.filter((r) => !r.ocrText).length;
  if (empty === results.length && results.length > 0) {
    console.error(
      "[ocr] every frame came back empty — check that tesseract and the OCR_LANGS packs are installed."
    );
  }

  return results;
}
