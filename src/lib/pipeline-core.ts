import fs from "fs/promises";
import path from "path";
import { buildTimeline } from "./align";
import { extractAudio, extractFrames, probeVideo, type VideoMeta } from "./ffmpeg";
import { deduplicateFrames } from "./frames";
import { runOcr } from "./ocr";
import { runQualityCheck } from "./quality-check";
import { generateSkill } from "./skill-generator";
import { transcribeChunks } from "./transcript";
import { analyzeFrames } from "./vision";
import type { JobOptions, JobStage, QualityReport, TimelineEntry, TranscriptSegment } from "./schemas";

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

  // 1. Probe
  await set("probing", 5, "Analyzing video (ffprobe)");
  const meta = await probeVideo(videoPath);
  if (!meta.hasAudio) throw new Error("The video has no audio track.");
  if (meta.durationSec < 1) throw new Error("Unreadable or empty video.");
  if (opts.onProbe) await opts.onProbe(meta);

  // 2. Audio
  await set("extracting_audio", 12, "Extracting and splitting audio");
  const audioChunks = await extractAudio(videoPath, audioDir);

  // 3. Transcription
  await set("transcribing", 20, "Timestamped transcription");
  const transcript = await transcribeChunks(audioChunks, options.language, async (done, total) => {
    await onProgress({ progress: 20 + Math.round((done / total) * (options.outputType === "transcript" ? 70 : 15)) });
  });

  // Transcript-only mode: stop here.
  if (options.outputType === "transcript") {
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

  // 4. Frames
  await set("extracting_frames", 35, "Extracting frames (regular + scene changes)");
  const allFrames = await extractFrames(videoPath, framesDir, meta.durationSec);

  // 5. Dedup
  await set("deduplicating", 45, `Deduplicating frames (${allFrames.length} raw)`);
  const frames = await deduplicateFrames(allFrames);
  await onProgress({ message: `${frames.length} useful frames kept` });

  // 6. OCR
  await set("ocr", 50, "OCR on frames (Tesseract)");
  const ocrResults = await runOcr(frames);

  // 7. Vision
  await set("vision", 55, "Visual analysis of frames");
  const visual = await analyzeFrames(frames, ocrResults, transcript, async (done, total) => {
    await onProgress({
      progress: 55 + Math.round((done / total) * 25),
      message: `Visual analysis ${done}/${total}`,
    });
  });

  // 8. Timeline
  await set("merging", 80, "Merging transcript + OCR + vision");
  const timeline: TimelineEntry[] = buildTimeline(
    transcript,
    frames,
    ocrResults,
    visual,
    meta.durationSec
  );

  // 9. skill.md
  await set("generating", 85, "Generating skill.md");
  const draft = await generateSkill({
    fileName,
    durationSec: meta.durationSec,
    timeline,
    options,
  });

  // 10. Quality check
  await set("quality_check", 92, "Quality check");
  let audited = await runQualityCheck(draft, timeline);
  if (options.ultraPrecise && audited.finalSkill !== draft) {
    audited = await runQualityCheck(audited.finalSkill, timeline);
  }

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
