import path from "path";

export type Provider = "openai" | "anthropic";

export const config = {
  dataDir: path.resolve(process.env.DATA_DIR ?? "./data/jobs"),

  transcriptionProvider: (process.env.TRANSCRIPTION_PROVIDER ?? "openai") as Provider,
  visionProvider: (process.env.VISION_PROVIDER ?? "anthropic") as Provider,
  synthesisProvider: (process.env.SYNTHESIS_PROVIDER ?? "anthropic") as Provider,

  openaiTranscribeModel: process.env.OPENAI_TRANSCRIBE_MODEL ?? "gpt-4o-transcribe",
  openaiVisionModel: process.env.OPENAI_VISION_MODEL ?? "gpt-4o",
  anthropicVisionModel: process.env.ANTHROPIC_VISION_MODEL ?? "claude-opus-4-8",
  anthropicSynthesisModel: process.env.ANTHROPIC_SYNTHESIS_MODEL ?? "claude-opus-4-8",

  frameIntervalSec: Number(process.env.FRAME_INTERVAL_SEC ?? 5),
  sceneThreshold: Number(process.env.SCENE_THRESHOLD ?? 0.3),
  audioChunkSec: Number(process.env.AUDIO_CHUNK_SEC ?? 600),
  maxVisionFrames: Number(process.env.MAX_VISION_FRAMES ?? 180),
  ocrLangs: process.env.OCR_LANGS ?? "fra+eng",
};
