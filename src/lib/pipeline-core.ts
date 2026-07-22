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
import type { JobOptions, JobStage, QualityReport, TimelineEntry } from "./schemas";

export interface ProgressUpdate {
  stage?: JobStage;
  progress?: number;
  message?: string;
}

export interface PipelineResult {
  meta: VideoMeta;
  durationSec: number;
  skillMd: string;
  report: QualityReport;
  transcriptJson: string;
  timelineJson: string;
  reportJson: string;
}

/**
 * Runs the full video -> skill.md pipeline against local files. This is the same
 * sequence the original local app used, decoupled from any job store so it can
 * run inside the worker (or anywhere with FFmpeg + Tesseract available).
 * Intermediate artifacts are returned as JSON strings for the caller to persist.
 */
export async function processVideo(opts: {
  videoPath: string;
  workDir: string;
  fileName: string;
  options: JobOptions;
  onProgress: (u: ProgressUpdate) => Promise<void>;
  // Called right after the (cheap) probe, before any expensive work — lets the
  // caller validate the real duration against the user's credits and abort.
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
  await set("probing", 5, "Analyse de la vidéo (ffprobe)");
  const meta = await probeVideo(videoPath);
  if (!meta.hasAudio) throw new Error("La vidéo ne contient pas de piste audio.");
  if (meta.durationSec < 1) throw new Error("Vidéo illisible ou vide.");
  if (opts.onProbe) await opts.onProbe(meta);

  // 2. Audio
  await set("extracting_audio", 10, "Extraction et découpage de l'audio");
  const audioChunks = await extractAudio(videoPath, audioDir);

  // 3. Transcription
  await set("transcribing", 15, "Transcription horodatée");
  const transcript = await transcribeChunks(audioChunks, options.language, async (done, total) => {
    await onProgress({ progress: 15 + Math.round((done / total) * 20) });
  });

  // 4. Frames
  await set("extracting_frames", 35, "Extraction des captures (régulières + scènes)");
  const allFrames = await extractFrames(videoPath, framesDir, meta.durationSec);

  // 5. Dedup
  await set("deduplicating", 45, `Déduplication des captures (${allFrames.length} brutes)`);
  const frames = await deduplicateFrames(allFrames);
  await onProgress({ message: `${frames.length} captures utiles conservées` });

  // 6. OCR
  await set("ocr", 50, "OCR des captures (Tesseract)");
  const ocrResults = await runOcr(frames);

  // 7. Vision
  await set("vision", 55, "Analyse visuelle des captures");
  const visual = await analyzeFrames(frames, ocrResults, transcript, async (done, total) => {
    await onProgress({
      progress: 55 + Math.round((done / total) * 25),
      message: `Analyse visuelle ${done}/${total}`,
    });
  });

  // 8. Timeline
  await set("merging", 80, "Fusion transcript + OCR + vision");
  const timeline: TimelineEntry[] = buildTimeline(
    transcript,
    frames,
    ocrResults,
    visual,
    meta.durationSec
  );

  // 9. skill.md
  await set("generating", 85, "Génération du skill.md");
  const draft = await generateSkill({
    fileName,
    durationSec: meta.durationSec,
    timeline,
    options,
  });

  // 10. Quality check (a second pass in ultra-precise mode)
  await set("quality_check", 92, "Contrôle qualité");
  let audited = await runQualityCheck(draft, timeline);
  if (options.ultraPrecise && audited.finalSkill !== draft) {
    audited = await runQualityCheck(audited.finalSkill, timeline);
  }

  return {
    meta,
    durationSec: meta.durationSec,
    skillMd: audited.finalSkill,
    report: audited.report,
    transcriptJson: JSON.stringify(transcript, null, 2),
    timelineJson: JSON.stringify(timeline, null, 2),
    reportJson: JSON.stringify(audited.report, null, 2),
  };
}
