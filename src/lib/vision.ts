import pLimit from "p-limit";
import path from "path";
import sharp from "sharp";
import { completeText, extractJson, type ImageInput } from "./ai";
import { config } from "./config";
import { ExtractedFrame } from "./ffmpeg";
import { VISION_RETRY_SUFFIX, VISION_SYSTEM, visionPrompt } from "./prompts";
import {
  OcrResult,
  parseVisualAnalysis,
  TranscriptSegment,
  VISUAL_ANALYSIS_JSON_SCHEMA,
  VisualAnalysis,
} from "./schemas";

export type VisionProgress = (done: number, total: number, note?: string) => Promise<void>;

function transcriptNear(segments: TranscriptSegment[], timestamp: number): string {
  const w = config.transcriptWindowSec;
  return segments
    .filter((s) => s.end >= timestamp - w && s.start <= timestamp + w)
    .map((s) => s.text)
    .join(" ")
    .slice(0, 1500);
}

/**
 * Encode a frame for the vision model. JPEG rather than PNG: image billing is
 * based on dimensions, so the token cost is identical, but a JPEG of a
 * screencast frame is roughly a tenth the size on the wire — which on 60 frames
 * is the difference between uploading ~150 MB and ~15 MB per job.
 */
async function frameToImage(file: string, width: number): Promise<ImageInput> {
  const buf = await sharp(file)
    .resize({ width, withoutEnlargement: true })
    .jpeg({ quality: config.jpegQuality, mozjpeg: true })
    .toBuffer();
  return { data: buf.toString("base64"), mediaType: "image/jpeg" };
}

async function analyzeOne(
  frame: ExtractedFrame,
  ocrText: string,
  nearbyTranscript: string,
  width: number,
  isRetry: boolean
): Promise<VisualAnalysis> {
  const frameName = path.basename(frame.file);
  try {
    const image = await frameToImage(frame.file, width);
    const text = await completeText({
      role: "vision",
      // Static — identical on every call, so the provider can cache the prefix.
      // The retry note goes in the variable half on purpose: appending it here
      // would change the prefix and invalidate the cache for every retry.
      system: VISION_SYSTEM,
      prompt:
        visionPrompt({ timestamp: frame.timestamp, ocrText, nearbyTranscript }) +
        (isRetry ? VISION_RETRY_SUFFIX : ""),
      images: [image],
      jsonSchema: { name: "visual_analysis", schema: VISUAL_ANALYSIS_JSON_SCHEMA },
    });
    return parseVisualAnalysis(extractJson(text), {
      timestamp: frame.timestamp,
      frame: frameName,
    });
  } catch (err) {
    // One bad frame must not sink the pipeline; record the failure so the
    // synthesis stage knows this moment is unevidenced rather than empty.
    return parseVisualAnalysis(
      {
        screen_type: "unknown",
        uncertainties: [
          `vision analysis failed: ${err instanceof Error ? err.message : err}`,
        ],
      },
      { timestamp: frame.timestamp, frame: frameName }
    );
  }
}

export async function analyzeFrames(
  frames: ExtractedFrame[],
  ocrResults: OcrResult[],
  transcript: TranscriptSegment[],
  onProgress: VisionProgress
): Promise<VisualAnalysis[]> {
  const ocrByFrame = new Map(ocrResults.map((o) => [o.frame, o.ocrText]));
  const limit = pLimit(Math.max(1, config.visionConcurrency));
  const contextFor = (frame: ExtractedFrame) => ({
    ocrText: ocrByFrame.get(path.basename(frame.file)) ?? "",
    nearbyTranscript: transcriptNear(transcript, frame.timestamp),
  });

  let done = 0;
  const results = await Promise.all(
    frames.map((frame) =>
      limit(async () => {
        const { ocrText, nearbyTranscript } = contextFor(frame);
        try {
          return await analyzeOne(
            frame,
            ocrText,
            nearbyTranscript,
            config.visionImageWidth,
            false
          );
        } finally {
          await onProgress(++done, frames.length);
        }
      })
    )
  );

  if (!config.visionRetryUncertain || config.visionRetryMaxFrames <= 0) return results;

  // Second pass, higher resolution, only on the frames the first pass could not
  // read. This is the cheap half of "don't invent UI": rather than paying for
  // every frame at 2576px, pay for the handful that actually needed it.
  const candidates = results
    .map((r, i) => ({ index: i, count: r.uncertainties.length }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, config.visionRetryMaxFrames);

  if (candidates.length === 0) return results;
  await onProgress(frames.length, frames.length, `re-reading ${candidates.length} unclear frames`);

  await Promise.all(
    candidates.map(({ index }) =>
      limit(async () => {
        const frame = frames[index];
        const { ocrText, nearbyTranscript } = contextFor(frame);
        const retried = await analyzeOne(
          frame,
          ocrText,
          nearbyTranscript,
          config.visionRetryImageWidth,
          true
        );
        // Only accept the retry if it actually resolved something. A retry that
        // came back just as unsure (or failed outright) must not overwrite a
        // usable first-pass reading.
        if (retried.uncertainties.length < results[index].uncertainties.length) {
          results[index] = retried;
        }
      })
    )
  );

  return results;
}
