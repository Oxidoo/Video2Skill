import fs from "fs";
import pLimit from "p-limit";
import { openai } from "./ai";
import { config } from "./config";
import { TranscriptSegment } from "./schemas";

/**
 * Transcribe audio chunks, converting per-chunk timestamps into global video
 * timestamps (chunk index x chunk duration offset).
 *
 * Chunks are independent, so they run in parallel — transcribing a 2-hour video
 * used to mean twelve sequential round trips. Results are reassembled in chunk
 * order regardless of completion order.
 */
export async function transcribeChunks(
  chunkFiles: string[],
  language: "fr" | "en" | "auto",
  onProgress: (done: number, total: number) => Promise<void>
): Promise<TranscriptSegment[]> {
  if (config.transcriptionProvider !== "openai") {
    throw new Error(`Unsupported transcription provider: ${config.transcriptionProvider}`);
  }

  const limit = pLimit(Math.max(1, config.transcriptionConcurrency));
  let done = 0;

  const perChunk = await Promise.all(
    chunkFiles.map((file, i) =>
      limit(async (): Promise<TranscriptSegment[]> => {
        const offset = i * config.audioChunkSec;
        try {
          const response = await openai().audio.transcriptions.create({
            file: fs.createReadStream(file),
            model: config.openaiTranscribeModel,
            response_format: "json",
            ...(language !== "auto" ? { language } : {}),
            // gpt-4o-transcribe models don't support verbose_json segment
            // timestamps; whisper-1 does. Handle both shapes below.
          });

          const anyResp = response as unknown as {
            segments?: { start: number; end: number; text: string }[];
            text?: string;
          };

          if (anyResp.segments?.length) {
            return anyResp.segments.map((s) => ({
              start: s.start + offset,
              end: s.end + offset,
              text: s.text.trim(),
            }));
          }
          if (anyResp.text?.trim()) {
            // No fine-grained timestamps available: attribute the whole chunk window.
            return [
              {
                start: offset,
                end: offset + config.audioChunkSec,
                text: anyResp.text.trim(),
              },
            ];
          }
          return [];
        } catch (err) {
          // A single failed chunk leaves a gap in the transcript; losing the
          // whole job over it would be worse. The gap is visible downstream
          // because the timeline simply has no speech for that window.
          console.error(
            `[transcript] chunk ${i} failed:`,
            err instanceof Error ? err.message : err
          );
          return [];
        } finally {
          await onProgress(++done, chunkFiles.length);
        }
      })
    )
  );

  return perChunk.flat().sort((a, b) => a.start - b.start);
}
