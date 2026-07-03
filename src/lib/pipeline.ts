import { buildTimeline } from "./align";
import { extractAudio, extractFrames, probeVideo } from "./ffmpeg";
import { deduplicateFrames } from "./frames";
import { failJob, jobPaths, readJob, updateJob, writeJson } from "./jobs";
import { runOcr } from "./ocr";
import { runQualityCheck } from "./quality-check";
import { generateSkill } from "./skill-generator";
import { transcribeChunks } from "./transcript";
import { analyzeFrames } from "./vision";
import fs from "fs/promises";

const runningJobs = new Set<string>();

export function startPipeline(jobId: string) {
  if (runningJobs.has(jobId)) return;
  runningJobs.add(jobId);
  runPipeline(jobId)
    .catch((err) => failJob(jobId, err))
    .finally(() => runningJobs.delete(jobId));
}

async function runPipeline(jobId: string) {
  const p = jobPaths(jobId);
  const job = await readJob(jobId);
  const set = (stage: Parameters<typeof updateJob>[1]["stage"], progress: number, message: string) =>
    updateJob(jobId, { stage, progress, message });

  // 1. Probe
  await set("probing", 5, "Analyse de la vidéo (ffprobe)");
  const meta = await probeVideo(p.video);
  if (!meta.hasAudio) throw new Error("La vidéo ne contient pas de piste audio.");
  if (meta.durationSec < 1) throw new Error("Vidéo illisible ou vide.");
  await updateJob(jobId, { meta });

  // 2. Audio
  await set("extracting_audio", 10, "Extraction et découpage de l'audio");
  const audioChunks = await extractAudio(p.video, p.audio);

  // 3. Transcription
  await set("transcribing", 15, "Transcription horodatée");
  const transcript = await transcribeChunks(audioChunks, job.options.language, async (done, total) => {
    await updateJob(jobId, { progress: 15 + Math.round((done / total) * 20) });
  });
  await writeJson(p.transcript, transcript);

  // 4. Frames
  await set("extracting_frames", 35, "Extraction des captures (régulières + changements de scène)");
  const allFrames = await extractFrames(p.video, p.frames, meta.durationSec);

  // 5. Dedup
  await set("deduplicating", 45, `Déduplication des captures (${allFrames.length} brutes)`);
  const frames = await deduplicateFrames(allFrames);
  await updateJob(jobId, { message: `${frames.length} captures utiles conservées` });

  // 6. OCR
  await set("ocr", 50, "OCR des captures (Tesseract)");
  const ocrResults = await runOcr(frames);
  await writeJson(p.ocr, ocrResults);

  // 7. Vision
  await set("vision", 55, "Analyse visuelle des captures");
  const visual = await analyzeFrames(frames, ocrResults, transcript, async (done, total) => {
    await updateJob(jobId, {
      progress: 55 + Math.round((done / total) * 25),
      message: `Analyse visuelle ${done}/${total}`,
    });
  });
  await writeJson(p.vision, visual);

  // 8. Timeline
  await set("merging", 80, "Fusion transcript + OCR + vision");
  const timeline = buildTimeline(transcript, frames, ocrResults, visual, meta.durationSec);
  await writeJson(p.timeline, timeline);

  // 9. skill.md
  await set("generating", 85, "Génération du skill.md");
  const draft = await generateSkill({
    fileName: job.fileName,
    durationSec: meta.durationSec,
    timeline,
    options: job.options,
  });

  // 10. Quality check
  await set("quality_check", 92, "Contrôle qualité");
  let audited = await runQualityCheck(draft, timeline);
  if (job.options.ultraPrecise && audited.finalSkill !== draft) {
    // Second audit pass on the corrected version for the slow/precise mode.
    audited = await runQualityCheck(audited.finalSkill, timeline);
  }

  await fs.writeFile(p.skill, audited.finalSkill);
  await writeJson(p.report, audited.report);

  await updateJob(jobId, {
    stage: "done",
    progress: 100,
    message: "skill.md prêt",
    qualityScore: audited.report.score,
  });
}
