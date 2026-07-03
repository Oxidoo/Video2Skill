import path from "path";
import { ExtractedFrame } from "./ffmpeg";
import { OcrResult, TimelineEntry, TranscriptSegment, VisualAnalysis } from "./schemas";

/**
 * Merge transcript, OCR and visual analysis into a single enriched timeline.
 * Transcript segments are grouped into ~15s windows; each window gets the
 * frames whose timestamps fall inside it.
 */
export function buildTimeline(
  transcript: TranscriptSegment[],
  frames: ExtractedFrame[],
  ocrResults: OcrResult[],
  visual: VisualAnalysis[],
  durationSec: number
): TimelineEntry[] {
  const ocrByFrame = new Map(ocrResults.map((o) => [o.frame, o.ocrText]));
  const visualByFrame = new Map(visual.map((v) => [v.frame, v]));

  // Group transcript segments into windows of ~15 seconds.
  const WINDOW = 15;
  const windows: { start: number; end: number; texts: string[] }[] = [];
  for (const seg of transcript) {
    const last = windows[windows.length - 1];
    if (last && seg.start - last.start < WINDOW) {
      last.end = Math.max(last.end, seg.end);
      last.texts.push(seg.text);
    } else {
      windows.push({ start: seg.start, end: seg.end, texts: [seg.text] });
    }
  }
  if (windows.length === 0) windows.push({ start: 0, end: durationSec, texts: [] });

  // Ensure full coverage so silent-but-visual moments keep their frames.
  const entries: TimelineEntry[] = windows.map((w) => ({
    start: w.start,
    end: w.end,
    spoken: w.texts.join(" ").trim(),
    frames: [],
  }));

  for (const frame of frames) {
    const name = path.basename(frame.file);
    let target = entries.find((e) => frame.timestamp >= e.start && frame.timestamp <= e.end);
    if (!target) {
      // Frame falls in a gap between spoken windows — attach to nearest entry.
      target = entries.reduce((best, e) =>
        Math.abs(e.start - frame.timestamp) < Math.abs(best.start - frame.timestamp) ? e : best
      );
    }
    target.frames.push({
      timestamp: frame.timestamp,
      frame: name,
      ocr: ocrByFrame.get(name) ?? "",
      visual: visualByFrame.get(name) ?? null,
    });
  }
  return entries;
}
