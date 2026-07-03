import pLimit from "p-limit";
import path from "path";
import sharp from "sharp";
import { completeText, extractJson } from "./ai";
import { config } from "./config";
import { ExtractedFrame } from "./ffmpeg";
import { visionPrompt } from "./prompts";
import { OcrResult, TranscriptSegment, VisualAnalysis } from "./schemas";

function transcriptNear(segments: TranscriptSegment[], timestamp: number, windowSec = 15): string {
  return segments
    .filter((s) => s.end >= timestamp - windowSec && s.start <= timestamp + windowSec)
    .map((s) => s.text)
    .join(" ")
    .slice(0, 1500);
}

async function frameToBase64(file: string): Promise<string> {
  // Downscale to control token cost while keeping UI text readable.
  const buf = await sharp(file).resize({ width: 1568, withoutEnlargement: true }).png().toBuffer();
  return buf.toString("base64");
}

export async function analyzeFrames(
  frames: ExtractedFrame[],
  ocrResults: OcrResult[],
  transcript: TranscriptSegment[],
  onProgress: (done: number, total: number) => Promise<void>
): Promise<VisualAnalysis[]> {
  const ocrByFrame = new Map(ocrResults.map((o) => [o.frame, o.ocrText]));
  const limit = pLimit(3);
  let done = 0;

  const results = await Promise.all(
    frames.map((frame) =>
      limit(async (): Promise<VisualAnalysis | null> => {
        const frameName = path.basename(frame.file);
        try {
          const data = await frameToBase64(frame.file);
          const text = await completeText({
            provider: config.visionProvider,
            prompt: visionPrompt({
              timestamp: frame.timestamp,
              ocrText: ocrByFrame.get(frameName) ?? "",
              nearbyTranscript: transcriptNear(transcript, frame.timestamp),
            }),
            imagesBase64: [{ data, mediaType: "image/png" }],
            maxTokens: 2048,
          });
          const parsed = VisualAnalysis.parse({
            ...(extractJson(text) as object),
            timestamp: frame.timestamp,
            frame: frameName,
          });
          return parsed;
        } catch (err) {
          // One bad frame must not sink the pipeline; record the failure.
          return VisualAnalysis.parse({
            timestamp: frame.timestamp,
            frame: frameName,
            screen_type: "unknown",
            uncertainties: [`vision analysis failed: ${err instanceof Error ? err.message : err}`],
          });
        } finally {
          await onProgress(++done, frames.length);
        }
      })
    )
  );
  return results.filter((r): r is VisualAnalysis => r !== null);
}
