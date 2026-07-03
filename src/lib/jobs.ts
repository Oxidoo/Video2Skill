import fs from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { config } from "./config";
import { JobOptions, JobState, JobStage } from "./schemas";

export function jobDir(jobId: string) {
  // Guard against path traversal in user-supplied jobIds.
  if (!/^job_[a-f0-9-]+$/.test(jobId)) throw new Error(`Invalid jobId: ${jobId}`);
  return path.join(config.dataDir, jobId);
}

export const jobPaths = (jobId: string) => {
  const root = jobDir(jobId);
  return {
    root,
    input: path.join(root, "input"),
    chunks: path.join(root, "input", "chunks"),
    video: path.join(root, "input", "video.mp4"),
    audio: path.join(root, "audio"),
    frames: path.join(root, "frames"),
    ocr: path.join(root, "ocr", "ocr.json"),
    vision: path.join(root, "vision", "visual_analysis.json"),
    transcript: path.join(root, "transcript", "transcript.json"),
    timeline: path.join(root, "merged", "timeline.json"),
    skill: path.join(root, "output", "skill.md"),
    report: path.join(root, "output", "report.json"),
    state: path.join(root, "job.json"),
  };
};

export async function createJob(fileName: string, options: JobOptions): Promise<JobState> {
  const jobId = `job_${uuidv4()}`;
  const p = jobPaths(jobId);
  for (const dir of [p.chunks, p.audio, p.frames]) {
    await fs.mkdir(dir, { recursive: true });
  }
  for (const file of [p.ocr, p.vision, p.transcript, p.timeline, p.skill]) {
    await fs.mkdir(path.dirname(file), { recursive: true });
  }
  const now = new Date().toISOString();
  const state: JobState = {
    jobId,
    fileName,
    stage: "created",
    progress: 0,
    message: "Job created",
    error: null,
    options,
    createdAt: now,
    updatedAt: now,
    meta: null,
    qualityScore: null,
  };
  await writeJob(state);
  return state;
}

export async function readJob(jobId: string): Promise<JobState> {
  const raw = await fs.readFile(jobPaths(jobId).state, "utf8");
  return JobState.parse(JSON.parse(raw));
}

export async function writeJob(state: JobState) {
  state.updatedAt = new Date().toISOString();
  await fs.writeFile(jobPaths(state.jobId).state, JSON.stringify(state, null, 2));
}

export async function updateJob(
  jobId: string,
  patch: Partial<JobState> & { stage?: JobStage }
): Promise<JobState> {
  const state = await readJob(jobId);
  const next = { ...state, ...patch };
  await writeJob(next);
  return next;
}

export async function failJob(jobId: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  await updateJob(jobId, { stage: "failed", error: message, message: "Processing failed" });
}

export async function writeJson(file: string, data: unknown) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(data, null, 2));
}

export async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await fs.readFile(file, "utf8")) as T;
}
