import path from "path";

export type Provider = "openai" | "anthropic";

/** Which pipeline stage an AI call belongs to — picks provider + model + budget. */
export type AiRole = "vision" | "synthesis" | "quality";

const num = (v: string | undefined, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};
const bool = (v: string | undefined, fallback: boolean) =>
  v === undefined || v === "" ? fallback : v !== "0" && v.toLowerCase() !== "false";

export const config = {
  dataDir: path.resolve(process.env.DATA_DIR ?? "./data/jobs"),

  // --- Providers ------------------------------------------------------------
  transcriptionProvider: (process.env.TRANSCRIPTION_PROVIDER ?? "openai") as Provider,
  visionProvider: (process.env.VISION_PROVIDER ?? "anthropic") as Provider,
  synthesisProvider: (process.env.SYNTHESIS_PROVIDER ?? "anthropic") as Provider,
  // The audit re-reads the whole skill.md; it runs once per job, so it can
  // afford a stronger model than the dozens of per-frame vision calls.
  qualityProvider: (process.env.QUALITY_PROVIDER ??
    process.env.SYNTHESIS_PROVIDER ??
    "anthropic") as Provider,

  // --- Models ---------------------------------------------------------------
  // Per-frame extraction is structured JSON with no real reasoning: the cheapest
  // capable model wins, and it is by far the highest-volume call in the pipeline.
  // Synthesis and audit are single calls where model quality actually shows up
  // in the output.
  openaiTranscribeModel: process.env.OPENAI_TRANSCRIBE_MODEL ?? "gpt-4o-transcribe",
  openaiVisionModel: process.env.OPENAI_VISION_MODEL ?? "gpt-4o-mini",
  openaiSynthesisModel: process.env.OPENAI_SYNTHESIS_MODEL ?? "gpt-4o",
  openaiQualityModel:
    process.env.OPENAI_QUALITY_MODEL ?? process.env.OPENAI_SYNTHESIS_MODEL ?? "gpt-4o",
  anthropicVisionModel: process.env.ANTHROPIC_VISION_MODEL ?? "claude-haiku-4-5",
  anthropicSynthesisModel: process.env.ANTHROPIC_SYNTHESIS_MODEL ?? "claude-sonnet-5",
  anthropicQualityModel:
    process.env.ANTHROPIC_QUALITY_MODEL ??
    process.env.ANTHROPIC_SYNTHESIS_MODEL ??
    "claude-sonnet-5",

  // --- Frame budget ---------------------------------------------------------
  // The budget scales with duration: a flat cap made a 5-minute clip cost as
  // much in vision as an hour-long one while earning a twelfth of the credits.
  framesPerMinute: num(process.env.FRAMES_PER_MINUTE, 3),
  minVisionFrames: num(process.env.MIN_VISION_FRAMES, 12),
  maxVisionFrames: num(process.env.MAX_VISION_FRAMES, 60),
  // Floor on the sampling interval, and how many candidates to extract per slot
  // so deduplication has something to choose from.
  frameIntervalSec: num(process.env.FRAME_INTERVAL_SEC, 5),
  frameOversample: num(process.env.FRAME_OVERSAMPLE, 3),
  sceneThreshold: num(process.env.SCENE_THRESHOLD, 0.3),

  // --- Vision ---------------------------------------------------------------
  visionConcurrency: num(process.env.VISION_CONCURRENCY, 4),
  // The strict-JSON answer is ~300 tokens; 2048 only inflated the reserved budget.
  visionMaxTokens: num(process.env.VISION_MAX_TOKENS, 1024),
  visionImageWidth: num(process.env.VISION_IMAGE_WIDTH, 1568),
  // Sonnet 5 / Haiku 4.5 accept up to 2576px on the long edge. Only worth paying
  // for on the frames the first pass could not read.
  visionRetryImageWidth: num(process.env.VISION_RETRY_IMAGE_WIDTH, 2576),
  visionRetryUncertain: bool(process.env.VISION_RETRY_UNCERTAIN, true),
  visionRetryMaxFrames: num(process.env.VISION_RETRY_MAX_FRAMES, 8),
  // JPEG costs the same in tokens as PNG (billing is dimension-based) but is
  // ~10x smaller on the wire, which is pure latency saved.
  jpegQuality: num(process.env.JPEG_QUALITY, 88),
  // Transcript context around a frame. align.ts groups speech into 15s windows,
  // so a ±15s window truncated the middle of a single explanation.
  transcriptWindowSec: num(process.env.TRANSCRIPT_WINDOW_SEC, 30),
  // Static instructions are cached across frames; needs a prefix long enough to
  // reach the model's minimum cacheable size (1024 tokens on Sonnet 5).
  promptCaching: bool(process.env.PROMPT_CACHING, true),
  structuredOutputs: bool(process.env.STRUCTURED_OUTPUTS, true),

  // --- Audio / transcription ------------------------------------------------
  audioChunkSec: num(process.env.AUDIO_CHUNK_SEC, 600),
  // FLAC is lossless and ~4x smaller than 16kHz mono WAV, which kept 10-minute
  // chunks uncomfortably close to the 25 MB transcription upload limit.
  audioCodec: (process.env.AUDIO_CODEC ?? "flac") as "flac" | "wav",
  transcriptionConcurrency: num(process.env.TRANSCRIPTION_CONCURRENCY, 4),

  // --- Synthesis / audit ----------------------------------------------------
  timelineMaxChars: num(process.env.TIMELINE_MAX_CHARS, 600_000),
  auditTimelineMaxChars: num(process.env.AUDIT_TIMELINE_MAX_CHARS, 300_000),
  // At or above this score the audit's findings are recorded but the draft is
  // kept, avoiding a full 16k-token rewrite on every job.
  qualityMinScore: num(process.env.QUALITY_MIN_SCORE, 80),
  synthesisMaxTokens: num(process.env.SYNTHESIS_MAX_TOKENS, 16384),

  // --- OCR ------------------------------------------------------------------
  ocrConcurrency: num(process.env.OCR_CONCURRENCY, 4),
  ocrLangs: process.env.OCR_LANGS ?? "fra+eng",
  // Tesseract on full-resolution screenshots is slow and no more accurate on UI
  // text than a normalized grayscale copy.
  ocrImageWidth: num(process.env.OCR_IMAGE_WIDTH, 1600),

  // --- Timeouts -------------------------------------------------------------
  apiTimeoutMs: num(process.env.API_TIMEOUT_MS, 90_000),
  apiMaxRetries: num(process.env.API_MAX_RETRIES, 2),
  ffmpegTimeoutMs: num(process.env.FFMPEG_TIMEOUT_MS, 900_000),
  ocrTimeoutMs: num(process.env.OCR_TIMEOUT_MS, 30_000),
  // Long silent stages (ffmpeg, OCR) must still touch Job.updatedAt or the
  // worker's stale-job sweep re-queues a job that is still running — and the
  // whole AI bill gets paid twice.
  heartbeatMs: num(process.env.HEARTBEAT_MS, 30_000),

  // --- Free tier / public pages ---------------------------------------------
  freeTranscriptEnabled: bool(process.env.FREE_TRANSCRIPT_ENABLED, true),
  freeTranscriptMaxMinutes: num(process.env.FREE_TRANSCRIPT_MAX_MINUTES, 20),
  freeTranscriptPerDay: num(process.env.FREE_TRANSCRIPT_PER_DAY, 3),
  publicSkillsEnabled: bool(process.env.PUBLIC_SKILLS_ENABLED, true),
};

/** Resolve provider + model + token budget for a pipeline stage. */
export function modelFor(role: AiRole): {
  provider: Provider;
  model: string;
  maxTokens: number;
} {
  switch (role) {
    case "vision":
      return {
        provider: config.visionProvider,
        model:
          config.visionProvider === "anthropic"
            ? config.anthropicVisionModel
            : config.openaiVisionModel,
        maxTokens: config.visionMaxTokens,
      };
    case "synthesis":
      return {
        provider: config.synthesisProvider,
        model:
          config.synthesisProvider === "anthropic"
            ? config.anthropicSynthesisModel
            : config.openaiSynthesisModel,
        maxTokens: config.synthesisMaxTokens,
      };
    case "quality":
      return {
        provider: config.qualityProvider,
        model:
          config.qualityProvider === "anthropic"
            ? config.anthropicQualityModel
            : config.openaiQualityModel,
        maxTokens: config.synthesisMaxTokens,
      };
  }
}

/**
 * How many frames the vision stage may analyze for a video of this length.
 * Proportional to duration, floored so short clips stay useful and capped so a
 * long video can't run away with the credit budget.
 */
export function visionFrameBudget(durationSec: number): number {
  const byDuration = Math.ceil((durationSec / 60) * config.framesPerMinute);
  return Math.min(config.maxVisionFrames, Math.max(config.minVisionFrames, byDuration));
}
