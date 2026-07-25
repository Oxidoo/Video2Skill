import { completeText } from "./ai";
import { config } from "./config";
import { SKILL_SYSTEM, skillPrompt } from "./prompts";
import { TimelineEntry, JobOptions } from "./schemas";

type CompactFrame = {
  t: number;
  ocr?: string;
  app?: string | null;
  window?: string | null;
  tab?: string | null;
  tabs?: string[];
  buttons?: string[];
  options?: { label: string; state: string | null; location: string | null }[];
  action?: string | null;
  uncertain?: string[];
};

/**
 * Serialize the timeline for the synthesis prompt, delta-encoded.
 *
 * On a screencast the same screen persists across many frames, so `buttons`,
 * `options` and `tabs` repeat verbatim dozens of times. Emitting a field only
 * when it changes from the previous frame that specified it typically halves
 * the payload with no information lost — and the synthesis prompt is the single
 * largest input in the pipeline. The prompt tells the model to resolve omitted
 * fields forward.
 */
function compactTimeline(timeline: TimelineEntry[], includeRawOcr: boolean): string {
  // Previous *emitted* value per field, as a comparable string.
  const prev: Record<string, string | undefined> = {};
  const changed = (key: string, value: unknown): boolean => {
    const encoded = JSON.stringify(value ?? null);
    if (prev[key] === encoded) return false;
    prev[key] = encoded;
    return true;
  };

  const compact = timeline.map((e) => ({
    start: Math.round(e.start),
    end: Math.round(e.end),
    spoken: e.spoken,
    frames: e.frames.map((f): CompactFrame => {
      const out: CompactFrame = { t: Math.round(f.timestamp) };
      if (includeRawOcr && f.ocr) out.ocr = f.ocr.slice(0, 400);
      const v = f.visual;
      if (!v) return out;

      if (changed("app", v.visible_app)) out.app = v.visible_app;
      if (changed("window", v.active_window)) out.window = v.active_window;
      if (changed("tab", v.selected_tab)) out.tab = v.selected_tab;
      if (v.visible_tabs.length && changed("tabs", v.visible_tabs)) out.tabs = v.visible_tabs;
      if (v.visible_buttons.length && changed("buttons", v.visible_buttons)) {
        out.buttons = v.visible_buttons;
      }
      if (v.visible_options.length && changed("options", v.visible_options)) {
        out.options = v.visible_options;
      }
      // Never delta-encoded: these describe this instant, not a persistent state.
      if (v.likely_action) out.action = v.likely_action;
      if (v.uncertainties.length) out.uncertain = v.uncertainties;
      return out;
    }),
  }));

  let json = JSON.stringify(compact);
  if (json.length > config.timelineMaxChars) {
    // Still oversized: drop raw OCR (the visual analysis already encodes it),
    // then thin the frames per window before truncating blindly.
    json = JSON.stringify(
      compact.map((e) => ({
        ...e,
        frames: e.frames.map(({ ocr: _ocr, ...rest }) => rest),
      }))
    );
  }
  if (json.length > config.timelineMaxChars) {
    json = JSON.stringify(
      compact.map((e) => ({ ...e, frames: e.frames.slice(0, 2) }))
    );
  }
  return json.slice(0, config.timelineMaxChars);
}

export async function generateSkill(args: {
  fileName: string;
  durationSec: number;
  timeline: TimelineEntry[];
  options: JobOptions;
}): Promise<string> {
  const markdown = await completeText({
    role: "synthesis",
    system: SKILL_SYSTEM,
    prompt: skillPrompt({
      fileName: args.fileName,
      durationSec: args.durationSec,
      language: args.options.language,
      includeTimestamps: args.options.includeTimestamps,
      timelineJson: compactTimeline(args.timeline, args.options.includeRawOcr),
    }),
    maxTokens: config.synthesisMaxTokens,
  });
  return markdown
    .replace(/^```(?:markdown|md)?\s*\n/, "")
    .replace(/\n```\s*$/, "")
    .trim();
}
