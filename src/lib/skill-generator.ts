import { completeText } from "./ai";
import { config } from "./config";
import { skillPrompt } from "./prompts";
import { TimelineEntry, JobOptions } from "./schemas";

/** Trim the timeline so the synthesis prompt stays within a safe budget. */
function compactTimeline(timeline: TimelineEntry[], includeRawOcr: boolean): string {
  const compact = timeline.map((e) => ({
    start: Math.round(e.start),
    end: Math.round(e.end),
    spoken: e.spoken,
    frames: e.frames.map((f) => ({
      t: Math.round(f.timestamp),
      ...(includeRawOcr && f.ocr ? { ocr: f.ocr.slice(0, 400) } : {}),
      ...(f.visual
        ? {
            app: f.visual.visible_app,
            window: f.visual.active_window,
            tab: f.visual.selected_tab,
            buttons: f.visual.visible_buttons,
            options: f.visual.visible_options,
            action: f.visual.likely_action,
            uncertain: f.visual.uncertainties,
          }
        : {}),
    })),
  }));
  let json = JSON.stringify(compact);
  // ~600k chars ≈ 150k tokens; drop OCR first, then truncate if still huge.
  if (json.length > 600_000) {
    json = JSON.stringify(compact.map((e) => ({ ...e, frames: e.frames.slice(0, 2) })));
  }
  return json.slice(0, 600_000);
}

export async function generateSkill(args: {
  fileName: string;
  durationSec: number;
  timeline: TimelineEntry[];
  options: JobOptions;
}): Promise<string> {
  const markdown = await completeText({
    provider: config.synthesisProvider,
    prompt: skillPrompt({
      fileName: args.fileName,
      durationSec: args.durationSec,
      language: args.options.language,
      includeTimestamps: args.options.includeTimestamps,
      timelineJson: compactTimeline(args.timeline, args.options.includeRawOcr),
    }),
    maxTokens: 16384,
  });
  return markdown.replace(/^```(?:markdown|md)?\s*\n/, "").replace(/\n```\s*$/, "").trim();
}
