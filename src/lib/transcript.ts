import fs from "fs";
import { openai } from "./ai";
import { config } from "./config";
import { TranscriptSegment } from "./schemas";

/**
 * Transcribe audio chunks sequentially, converting per-chunk timestamps
 * into global video timestamps (chunk index × chunk duration offset).
 */
export async function transcribeChunks(
  chunkFiles: string[],
  language: "fr" | "en" | "auto",
  onProgress: (done: number, total: number) => Promise<void>
): Promise<TranscriptSegment[]> {
  if (config.transcriptionProvider !== "openai") {
    throw new Error(`Unsupported transcription provider: ${config.transcriptionProvider}`);
  }
  const segments: TranscriptSegment[] = [];

  for (let i = 0; i < chunkFiles.length; i++) {
    const offset = i * config.audioChunkSec;
    const response = await openai().audio.transcriptions.create({
      file: fs.createReadStream(chunkFiles[i]),
      model: config.openaiTranscribeModel,
      response_format: "json",
      ...(language !== "auto" ? { language } : {}),
      // gpt-4o-transcribe models don't support verbose_json segment timestamps;
      // whisper-1 does. Handle both shapes below.
    });

    const anyResp = response as unknown as {
      segments?: { start: number; end: number; text: string }[];
      text?: string;
    };
    if (anyResp.segments?.length) {
      for (const s of anyResp.segments) {
        segments.push({ start: s.start + offset, end: s.end + offset, text: s.text.trim() });
      }
    } else if (anyResp.text) {
      // No fine-grained timestamps available: attribute the whole chunk window.
      segments.push({
        start: offset,
        end: offset + config.audioChunkSec,
        text: anyResp.text.trim(),
      });
    }
    await onProgress(i + 1, chunkFiles.length);
  }
  return segments;
}
