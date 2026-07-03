import { completeText, extractJson } from "./ai";
import { config } from "./config";
import { qualityPrompt } from "./prompts";
import { QualityReport, TimelineEntry } from "./schemas";
import { z } from "zod";

const AuditResponse = QualityReport.extend({
  corrected_skill_md: z.string().nullable().default(null),
});

export async function runQualityCheck(
  skillMd: string,
  timeline: TimelineEntry[]
): Promise<{ report: QualityReport; finalSkill: string }> {
  const timelineJson = JSON.stringify(
    timeline.map((e) => ({
      start: Math.round(e.start),
      end: Math.round(e.end),
      spoken: e.spoken,
      frames: e.frames.map((f) => ({
        t: Math.round(f.timestamp),
        buttons: f.visual?.visible_buttons ?? [],
        tab: f.visual?.selected_tab ?? null,
        action: f.visual?.likely_action ?? null,
      })),
    }))
  ).slice(0, 300_000);

  try {
    const text = await completeText({
      provider: config.synthesisProvider,
      prompt: qualityPrompt({ skillMd, timelineJson }),
      maxTokens: 16384,
    });
    const parsed = AuditResponse.parse(extractJson(text));
    return {
      report: { score: parsed.score, issues: parsed.issues },
      finalSkill: parsed.corrected_skill_md?.trim() || skillMd,
    };
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
