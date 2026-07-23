import path from "path";

export type Provider = "openai" | "anthropic";

export const config = {
  dataDir: path.resolve(process.env.DATA_DIR ?? "./data/jobs"),

  transcriptionProvider: (process.env.TRANSCRIPTION_PROVIDER ?? "openai") as Provider,
  visionProvider: (process.env.VISION_PROVIDER ?? "openai") as Provider,
  synthesisProvider: (process.env.SYNTHESIS_PROVIDER ?? "openai") as Provider,

  openaiTranscribeModel: process.env.OPENAI_TRANSCRIBE_MODEL ?? "gpt-4o-transcribe",
  openaiVisionModel: process.env.OPENAI_VISION_MODEL ?? "gpt-4o",
  anthropicVisionModel: process.env.ANTHROPIC_VISION_MODEL ?? "claude-sonnet-5",
  anthropicSynthesisModel: process.env.ANTHROPIC_SYNTHESIS_MODEL ?? "claude-sonnet-5",

  frameIntervalSec: Number(process.env.FRAME_INTERVAL_SEC ?? 5),
  sceneThreshold: Number(process.env.SCENE_THRESHOLD ?? 0.3),
  audioChunkSec: Number(process.env.AUDIO_CHUNK_SEC ?? 600),
  // Balanced-fast defaults: fewer frames + more parallelism keep a typical
  // video well under a few minutes without hurting quality much. Override for
  // max quality with MAX_VISION_FRAMES / VISION_CONCURRENCY.
  maxVisionFrames: Number(process.env.MAX_VISION_FRAMES ?? 60),
  visionConcurrency: Number(process.env.VISION_CONCURRENCY ?? 4),
  ocrLangs: process.env.OCR_LANGS ?? "fra+eng",

  // Per-request timeout + retries so a single slow/hung AI call can't stall a
  // whole job for tens of minutes.
  apiTimeoutMs: Number(process.env.API_TIMEOUT_MS ?? 90_000),
  apiMaxRetries: Number(process.env.API_MAX_RETRIES ?? 2),

  // Child-process (ffmpeg/tesseract) timeouts. A hung Tesseract call used to
  // stall the whole job at the OCR stage until the CI runner was killed.
  ffmpegTimeoutMs: Number(process.env.FFMPEG_TIMEOUT_MS ?? 900_000),
  ocrTimeoutMs: Number(process.env.OCR_TIMEOUT_MS ?? 30_000),
};
