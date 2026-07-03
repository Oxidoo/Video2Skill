import { execa } from "execa";
import pLimit from "p-limit";
import path from "path";
import { config } from "./config";
import { ExtractedFrame } from "./ffmpeg";
import { OcrResult } from "./schemas";

export async function runOcr(frames: ExtractedFrame[]): Promise<OcrResult[]> {
  const limit = pLimit(4);
  const results = await Promise.all(
    frames.map((frame) =>
      limit(async (): Promise<OcrResult> => {
        try {
          const { stdout } = await execa("tesseract", [
            frame.file,
            "stdout",
            "-l", config.ocrLangs,
            "--psm", "6",
          ]);
          return {
            frame: path.basename(frame.file),
            timestamp: frame.timestamp,
            ocrText: stdout.replace(/\s+/g, " ").trim(),
          };
        } catch {
          return { frame: path.basename(frame.file), timestamp: frame.timestamp, ocrText: "" };
        }
      })
    )
  );
  return results;
}
