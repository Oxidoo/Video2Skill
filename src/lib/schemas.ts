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
  // "skill" = full skill.md pipeline; "transcript" = timestamped transcript only
  // (skips frames/OCR/vision/synthesis, much cheaper).
  outputType: z.enum(["skill", "transcript"]).default("skill"),
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

// ---------------------------------------------------------------------------
// Wire schemas for structured outputs.
//
// Both providers constrain generation to these, which removes the "model wrote
// prose around the JSON" failure class entirely. They deliberately avoid
// nullable types and optional keys: OpenAI's strict mode requires every
// property in `required` with `additionalProperties: false`, and null-vs-empty
// support differs between providers. The wire format therefore uses "" and -1
// as absent markers, and the normalizers below map them back to the nullable
// shapes the rest of the pipeline expects.
// ---------------------------------------------------------------------------

const emptyToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);

export const VISUAL_ANALYSIS_JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: [
    "screen_type",
    "visible_app",
    "active_window",
    "visible_tabs",
    "selected_tab",
    "visible_buttons",
    "visible_options",
    "cursor_or_focus",
    "likely_action",
    "uncertainties",
  ],
  properties: {
    screen_type: {
      type: "string",
      enum: ["software_ui", "website", "slide", "terminal", "other", "unknown"],
    },
    visible_app: { type: "string", description: "Application name, or \"\" if not identifiable." },
    active_window: { type: "string", description: "Window/dialog title, or \"\"." },
    visible_tabs: { type: "array", items: { type: "string" } },
    selected_tab: { type: "string", description: "Active tab label, or \"\"." },
    visible_buttons: { type: "array", items: { type: "string" } },
    visible_options: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "state", "location"],
        properties: {
          label: { type: "string" },
          state: { type: "string", description: "checked/unchecked/disabled/..., or \"\"." },
          location: { type: "string", description: "Where on screen, or \"\"." },
        },
      },
    },
    cursor_or_focus: { type: "string" },
    likely_action: { type: "string" },
    uncertainties: { type: "array", items: { type: "string" } },
  },
};

/** Parse a raw structured-output payload into a VisualAnalysis. */
export function parseVisualAnalysis(
  raw: unknown,
  meta: { timestamp: number; frame: string }
): VisualAnalysis {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const options = Array.isArray(obj.visible_options) ? obj.visible_options : [];
  return VisualAnalysis.parse({
    timestamp: meta.timestamp,
    frame: meta.frame,
    screen_type: obj.screen_type ?? "unknown",
    visible_app: emptyToNull(obj.visible_app) ?? null,
    active_window: emptyToNull(obj.active_window) ?? null,
    visible_tabs: obj.visible_tabs ?? [],
    selected_tab: emptyToNull(obj.selected_tab) ?? null,
    visible_buttons: obj.visible_buttons ?? [],
    visible_options: options.map((o) => {
      const opt = (o ?? {}) as Record<string, unknown>;
      return {
        label: String(opt.label ?? ""),
        state: emptyToNull(opt.state) ?? null,
        location: emptyToNull(opt.location) ?? null,
      };
    }),
    cursor_or_focus: emptyToNull(obj.cursor_or_focus) ?? null,
    likely_action: emptyToNull(obj.likely_action) ?? null,
    uncertainties: obj.uncertainties ?? [],
  });
}

export const QUALITY_AUDIT_JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["score", "issues"],
  properties: {
    score: { type: "integer", description: "0-100 overall reliability score." },
    issues: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["severity", "problem", "timestamp", "recommended_fix"],
        properties: {
          severity: { type: "string", enum: ["low", "medium", "high"] },
          problem: { type: "string" },
          timestamp: {
            type: "number",
            description: "Source timestamp in seconds, or -1 when not tied to one.",
          },
          recommended_fix: { type: "string" },
        },
      },
    },
  },
};

/** Parse a raw audit payload into a QualityReport (-1 timestamps become null). */
export function parseQualityReport(raw: unknown): QualityReport {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const issues = Array.isArray(obj.issues) ? obj.issues : [];
  return QualityReport.parse({
    score: Math.max(0, Math.min(100, Number(obj.score ?? 0))),
    issues: issues.map((i) => {
      const issue = (i ?? {}) as Record<string, unknown>;
      const ts = Number(issue.timestamp);
      return {
        severity: issue.severity ?? "low",
        problem: String(issue.problem ?? ""),
        timestamp: Number.isFinite(ts) && ts >= 0 ? ts : null,
        recommended_fix: String(issue.recommended_fix ?? ""),
      };
    }),
  });
}

/** True when the audit found something worth paying for a full rewrite. */
export function hasBlockingIssues(report: QualityReport): boolean {
  return report.issues.some((i) => i.severity === "high" || i.severity === "medium");
}
