import { z } from "zod";

export const JobStage = z.enum([
  "created",
  "uploading",
  "uploaded",
  "probing",
  "extracting_audio",
  "transcribing",
  "extracting_frames",
  "deduplicating",
  "ocr",
  "vision",
  "merging",
  "generating",
  "quality_check",
  "done",
  "failed",
]);
export type JobStage = z.infer<typeof JobStage>;

export const JobOptions = z.object({
  ultraPrecise: z.boolean().default(false),
  includeRawOcr: z.boolean().default(false),
  includeTimestamps: z.boolean().default(true),
  language: z.enum(["fr", "en", "auto"]).default("auto"),
});
export type JobOptions = z.infer<typeof JobOptions>;

export const JobState = z.object({
  jobId: z.string(),
  fileName: z.string(),
  stage: JobStage,
  progress: z.number().min(0).max(100),
  message: z.string().default(""),
  error: z.string().nullable().default(null),
  options: JobOptions,
  createdAt: z.string(),
  updatedAt: z.string(),
  meta: z
    .object({
      durationSec: z.number(),
      width: z.number(),
      height: z.number(),
      fps: z.number(),
      hasAudio: z.boolean(),
      sizeBytes: z.number(),
    })
    .nullable()
    .default(null),
  qualityScore: z.number().nullable().default(null),
});
export type JobState = z.infer<typeof JobState>;

export const TranscriptSegment = z.object({
  start: z.number(),
  end: z.number(),
  text: z.string(),
});
export type TranscriptSegment = z.infer<typeof TranscriptSegment>;

export const OcrResult = z.object({
  frame: z.string(),
  timestamp: z.number(),
  ocrText: z.string(),
});
export type OcrResult = z.infer<typeof OcrResult>;

export const VisualAnalysis = z.object({
  timestamp: z.number(),
  frame: z.string(),
  screen_type: z.string().default("unknown"),
  visible_app: z.string().nullable().default(null),
  active_window: z.string().nullable().default(null),
  visible_tabs: z.array(z.string()).default([]),
  selected_tab: z.string().nullable().default(null),
  visible_buttons: z.array(z.string()).default([]),
  visible_options: z
    .array(
      z.object({
        label: z.string(),
        state: z.string().nullable().default(null),
        location: z.string().nullable().default(null),
      })
    )
    .default([]),
  cursor_or_focus: z.string().nullable().default(null),
  likely_action: z.string().nullable().default(null),
  uncertainties: z.array(z.string()).default([]),
});
export type VisualAnalysis = z.infer<typeof VisualAnalysis>;

export const TimelineEntry = z.object({
  start: z.number(),
  end: z.number(),
  spoken: z.string(),
  frames: z.array(
    z.object({
      timestamp: z.number(),
      frame: z.string(),
      ocr: z.string(),
      visual: VisualAnalysis.nullable(),
    })
  ),
});
export type TimelineEntry = z.infer<typeof TimelineEntry>;

export const QualityIssue = z.object({
  severity: z.enum(["low", "medium", "high"]),
  problem: z.string(),
  timestamp: z.number().nullable().default(null),
  recommended_fix: z.string(),
});

export const QualityReport = z.object({
  score: z.number().min(0).max(100),
  issues: z.array(QualityIssue).default([]),
});
export type QualityReport = z.infer<typeof QualityReport>;
