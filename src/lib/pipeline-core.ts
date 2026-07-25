import fs from "fs/promises";
import path from "path";
import { buildTimeline } from "./align";
import { visionFrameBudget } from "./config";
import { extractAudio, extractMedia, probeVideo, type VideoMeta } from "./ffmpeg";
import { deduplicateFrames } from "./frames";
import { runOcr } from "./ocr";
import { runQualityCheck } from "./quality-check";
import { generateSkill } from "./skill-generator";
import { transcribeChunks } from "./transcript";
import { analyzeFrames } from "./vision";
import type {
  JobOptions,
  JobStage,
  QualityReport,
  TimelineEntry,
  TranscriptSegment,
} from "./schemas";

export interface ProgressUpdate {
  stage?: JobStage;
  progress?: number;
  message?: string;
}

export interface PipelineResult {
  meta: VideoMeta;
  durationSec: number;
  output: string; // skill.md markdown or the plain-text transcript
  report: QualityReport;
  transcriptJson: string;
  timelineJson: string;
  reportJson: string;
}

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatTranscript(fileName: string, segments: TranscriptSegment[]): string {
  const header = `# Transcript — ${fileName}\n\n`;
  if (segments.length === 0) return `${header}(No speech detected.)\n`;
  return header + segments.map((s) => `[${fmtTime(s.start)}] ${s.text}`).join("\n") + "\n";
}

/**
 * Runs the video pipeline against local files. With outputType "transcript" it
 * stops after transcription (much cheaper); otherwise it produces a full
 * skill.md. Intermediate artifacts are returned as JSON strings to persist.
 */
export async function processVideo(opts: {
  videoPath: string;
  workDir: string;
  fileName: string;
  options: JobOptions;
  onProgress: (u: ProgressUpdate) => Promise<void>;
  onProbe?: (meta: VideoMeta) => Promise<void>;
}): Promise<PipelineResult> {
  const { videoPath, workDir, fileName, options, onProgress } = opts;
  const audioDir = path.join(workDir, "audio");
  const framesDir = path.join(workDir, "frames");
  await fs.mkdir(audioDir, { recursive: true });
  await fs.mkdir(framesDir, { recursive: true });

  const set = (stage: JobStage, progress: number, message: string) =>
    onProgress({ stage, progress, message });

  const transcriptOnly = options.outputType === "transcript";

  // 1. Probe. Transcript-only jobs are handed an audio-only download on
  //    purpose (nothing downstream looks at a frame), so a missing video
  //    stream is expected there rather than a sign of a corrupt file.
  await set("probing", 5, "Analyzing video (ffprobe)");
  const meta = await probeVideo(videoPath, { requireVideo: !transcriptOnly });
  if (!meta.hasAudio) throw new Error("The video has no audio track.");
  if (meta.durationSec < 1) throw new Error("Unreadable or empty video.");
  if (opts.onProbe) await opts.onProbe(meta);

  // 2. Media extraction. For a full skill.md this is a single ffmpeg decode
  //    producing the audio chunks, the sampled frames and the scene-change
  //    frames at once — the pipeline used to decode the video four times.
  await set(
    "extracting_audio",
    12,
    transcriptOnly ? "Extracting and splitting audio" : "Extracting audio and frames"
  );
  const frameBudget = visionFrameBudget(meta.durationSec);
  const media = transcriptOnly
    ? { audioChunks: await extractAudio(videoPath, audioDir), frames: [] }
    : await extractMedia(videoPath, audioDir, framesDir, meta.durationSec, frameBudget);

  // 3. Transcription (chunks run in parallel)
  await set("transcribing", 20, "Timestamped transcription");
  const transcript = await transcribeChunks(
    media.audioChunks,
    options.language,
    async (done, total) => {
      await onProgress({
        progress: 20 + Math.round((done / total) * (transcriptOnly ? 70 : 15)),
      });
    }
  );

  // Transcript-only mode: stop here.
  if (transcriptOnly) {
    await set("generating", 95, "Formatting transcript");
    const trivialReport: QualityReport = { score: 100, issues: [] };
    return {
      meta,
      durationSec: meta.durationSec,
      output: formatTranscript(fileName, transcript),
      report: trivialReport,
      transcriptJson: JSON.stringify(transcript, null, 2),
      timelineJson: "[]",
      reportJson: JSON.stringify(trivialReport, null, 2),
    };
  }

  // 4. Dedup + budget. The budget scales with duration so a short clip no
  //    longer costs as much vision as an hour-long one.
  await set(
    "extracting_frames",
    35,
    `${media.frames.length} candidate frames extracted`
  );
  await set("deduplicating", 45, `Deduplicating frames (budget: ${frameBudget})`);
  const frames = await deduplicateFrames(media.frames, frameBudget);
  await onProgress({ message: `${frames.length} useful frames kept` });

  // 5. OCR
  await set("ocr", 50, "OCR on frames (Tesseract)");
  const ocrResults = await runOcr(frames, async (done, total) => {
    await onProgress({ progress: 50 + Math.round((done / total) * 5), message: `OCR ${done}/${total}` });
  });

  // 6. Vision
  await set("vision", 55, "Visual analysis of frames");
  const visual = await analyzeFrames(frames, ocrResults, transcript, async (done, total, note) => {
    await onProgress({
      progress: 55 + Math.round((done / total) * 25),
      message: note ?? `Visual analysis ${done}/${total}`,
    });
  });

  // 7. Timeline
  await set("merging", 80, "Merging transcript + OCR + vision");
  const timeline: TimelineEntry[] = buildTimeline(
    transcript,
    frames,
    ocrResults,
    visual,
    meta.durationSec
  );

  // 8. skill.md
  await set("generating", 85, "Generating skill.md");
  const draft = await generateSkill({
    fileName,
    durationSec: meta.durationSec,
    timeline,
    options,
  });

  // 9. Quality check. The audit always runs; the expensive rewrite only happens
  //    when the audit says the document falls below the bar.
  await set("quality_check", 92, "Quality check");
  const audited = await runQualityCheck(draft, timeline, {
    maxRepairs: options.ultraPrecise ? 2 : 1,
  });

  return {
    meta,
    durationSec: meta.durationSec,
    output: audited.finalSkill,
    report: audited.report,
    transcriptJson: JSON.stringify(transcript, null, 2),
    timelineJson: JSON.stringify(timeline, null, 2),
    reportJson: JSON.stringify(audited.report, null, 2),
  };
}
