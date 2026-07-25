import { execa } from "execa";
import pLimit from "p-limit";
import path from "path";
import sharp from "sharp";
import { config } from "./config";
import { ExtractedFrame } from "./ffmpeg";
import { OcrResult } from "./schemas";

/**
 * Normalize a frame for Tesseract: downscale, grayscale, stretch contrast.
 * Full-resolution colour screenshots are slow to OCR and no more accurate on UI
 * text than a normalized grayscale copy.
 */
async function prepareForOcr(file: string): Promise<Buffer> {
  return sharp(file)
    .resize({ width: config.ocrImageWidth, withoutEnlargement: true })
    .grayscale()
    .normalize()
    .png()
    .toBuffer();
}

/**
 * OCR every frame. `onProgress` matters for more than the UI: the OCR stage can
 * run for minutes without touching the database, and the worker re-queues any
 * job whose row has gone quiet — which meant a still-running job could be
 * picked up again and the whole AI bill paid twice.
 */
export async function runOcr(
  frames: ExtractedFrame[],
  onProgress?: (done: number, total: number) => Promise<void>
): Promise<OcrResult[]> {
  const limit = pLimit(Math.max(1, config.ocrConcurrency));
  let done = 0;

  return Promise.all(
    frames.map((frame) =>
      limit(async (): Promise<OcrResult> => {
        const base = { frame: path.basename(frame.file), timestamp: frame.timestamp };
        try {
          const image = await prepareForOcr(frame.file);
          // Feed Tesseract over stdin so the normalized copy never hits disk.
          const { stdout } = await execa(
            "tesseract",
            ["stdin", "stdout", "-l", config.ocrLangs, "--psm", "6"],
            { input: image, timeout: config.ocrTimeoutMs }
          );
          return { ...base, ocrText: stdout.replace(/\s+/g, " ").trim() };
        } catch {
          return { ...base, ocrText: "" };
        } finally {
          done++;
          if (onProgress) await onProgress(done, frames.length);
        }
      })
    )
  );
}
