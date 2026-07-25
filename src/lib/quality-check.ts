import { completeText, extractJson } from "./ai";
import { config } from "./config";
import { AUDIT_SYSTEM, auditPrompt, REPAIR_SYSTEM, repairPrompt } from "./prompts";
import {
  parseQualityReport,
  QUALITY_AUDIT_JSON_SCHEMA,
  QualityReport,
  TimelineEntry,
} from "./schemas";

/**
 * Timeline view for the audit — only the fields an auditor can check a claim
 * against. Deliberately narrower than the synthesis view.
 */
function auditTimeline(timeline: TimelineEntry[]): string {
  return JSON.stringify(
    timeline.map((e) => ({
      start: Math.round(e.start),
      end: Math.round(e.end),
      spoken: e.spoken,
      frames: e.frames.map((f) => ({
        t: Math.round(f.timestamp),
        buttons: f.visual?.visible_buttons ?? [],
        tab: f.visual?.selected_tab ?? null,
        action: f.visual?.likely_action ?? null,
        uncertain: f.visual?.uncertainties ?? [],
      })),
    }))
  ).slice(0, config.auditTimelineMaxChars);
}

/** True when findings justify paying for a full document rewrite. */
function needsRepair(report: QualityReport): boolean {
  return (
    report.score < config.qualityMinScore ||
    report.issues.some((i) => i.severity === "high")
  );
}

async function audit(skillMd: string, timelineJson: string): Promise<QualityReport> {
  const text = await completeText({
    role: "quality",
    system: AUDIT_SYSTEM,
    prompt: auditPrompt({ skillMd, timelineJson }),
    jsonSchema: { name: "quality_audit", schema: QUALITY_AUDIT_JSON_SCHEMA },
    // Findings only — no document rewrite, so the output stays small.
    maxTokens: 4096,
  });
  return parseQualityReport(extractJson(text));
}

async function repair(
  skillMd: string,
  report: QualityReport,
  timelineJson: string
): Promise<string> {
  const markdown = await completeText({
    role: "quality",
    system: REPAIR_SYSTEM,
    prompt: repairPrompt({
      skillMd,
      issuesJson: JSON.stringify(report.issues),
      timelineJson,
    }),
    maxTokens: config.synthesisMaxTokens,
  });
  const cleaned = markdown
    .replace(/^```(?:markdown|md)?\s*\n/, "")
    .replace(/\n```\s*$/, "")
    .trim();
  // A truncated or empty rewrite is worse than the draft it replaces.
  return cleaned.length > skillMd.length * 0.5 ? cleaned : skillMd;
}

/**
 * Audit the generated skill.md, and rewrite it only when the audit says it is
 * worth it.
 *
 * The previous version asked for a full corrected document on every job: ~16k
 * output tokens on the most expensive model, regenerated even when nothing was
 * wrong. Splitting audit from repair means the common case costs one small
 * findings call, and the expensive rewrite is reserved for documents that
 * actually fail the bar. Each repair is re-audited so the score we report and
 * store describes the document we actually ship.
 */
export async function runQualityCheck(
  skillMd: string,
  timeline: TimelineEntry[],
  opts: { maxRepairs?: number } = {}
): Promise<{ report: QualityReport; finalSkill: string }> {
  const maxRepairs = Math.max(0, opts.maxRepairs ?? 1);
  const timelineJson = auditTimeline(timeline);

  try {
    let current = skillMd;
    let report = await audit(current, timelineJson);

    for (let i = 0; i < maxRepairs && needsRepair(report); i++) {
      const repaired = await repair(current, report, timelineJson);
      if (repaired === current) break;
      current = repaired;
      report = await audit(current, timelineJson);
    }

    return { report, finalSkill: current };
  } catch (err) {
    // The audit is a safety net, not a hard dependency — keep the draft skill.
    return {
      report: {
        score: 0,
        issues: [
          {
            severity: "high",
            problem: `Quality check failed to run: ${err instanceof Error ? err.message : err}`,
            timestamp: null,
            recommended_fix: "Review the skill.md manually.",
          },
        ],
      },
      finalSkill: skillMd,
    };
  }
}
