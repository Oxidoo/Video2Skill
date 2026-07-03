export const visionPrompt = (args: {
  timestamp: number;
  ocrText: string;
  nearbyTranscript: string;
}) => `You are analyzing a screenshot extracted from a software training video.

Return strict JSON only, matching exactly this shape:
{
  "screen_type": "software_ui | website | slide | terminal | other | unknown",
  "visible_app": string | null,
  "active_window": string | null,
  "visible_tabs": string[],
  "selected_tab": string | null,
  "visible_buttons": string[],
  "visible_options": [{ "label": string, "state": string | null, "location": string | null }],
  "cursor_or_focus": string | null,
  "likely_action": string | null,
  "uncertainties": string[]
}

Rules:
- Do not invent UI labels.
- If text is unclear, mark it in "uncertainties".
- Use OCR text as a secondary clue, not as absolute truth.
- Include spatial location of important UI elements when visible.

Timestamp: ${args.timestamp}
OCR text: ${args.ocrText || "(none)"}
Transcript near this timestamp: ${args.nearbyTranscript || "(none)"}`;

export const skillPrompt = (args: {
  fileName: string;
  durationSec: number;
  language: string;
  timelineJson: string;
  includeTimestamps: boolean;
}) => `You are creating a reliable AI skill from a software training video.

You receive a merged timeline combining: timestamped transcript, OCR from screenshots, and visual analysis of screenshots.

Create a \`skill.md\` knowledge base with this exact structure:

# Skill — [Training name inferred from content]
## 1. Objectif du skill
## 2. Source vidéo
(durée: ${Math.round(args.durationSec)}s, fichier: ${args.fileName}, langue: ${args.language}, date de génération: ${new Date().toISOString().slice(0, 10)}, niveau de confiance global, limites connues)
## 3. Règles d'utilisation par l'IA
- Ne pas inventer les étapes absentes de la vidéo.
- Toujours distinguer ce qui est vu à l'écran de ce qui est dit oralement.
- Si une interface n'est pas lisible, signaler l'incertitude.
- Quand possible, citer le timestamp source.
- Répondre avec des étapes concrètes.
## 4. Concepts clés de la formation
## 5. Procédures opérationnelles
(each procedure: Objectif, Contexte logiciel, Timestamp source, Pré-requis, #### Étapes numérotées, #### Repères visuels, #### Résultat attendu, #### Erreurs fréquentes, #### Niveau de confiance Élevé/Moyen/Faible)
## 6. Glossaire
## 7. FAQ
## 8. Cas pratiques
## 9. Zones incertaines à vérifier manuellement

Rules:
- Do not write a generic summary. Create actionable procedures.
- Each procedure must include timestamp sources.${args.includeTimestamps ? "" : " (timestamps may be coarse)"}
- Distinguish spoken information from visible UI information.
- Include visual landmarks, uncertainties, common mistakes and expected outcomes.
- Do not invent software options that are not grounded in the timeline.
- Never generate UI-dependent procedures from transcript alone: if no frame/OCR supports a UI step, mark it uncertain.
- Write the skill in the same language as the training (detected: ${args.language}).
- Output valid Markdown only, no code fence around the whole document.

TIMELINE:
${args.timelineJson}`;

export const qualityPrompt = (args: { skillMd: string; timelineJson: string }) => `You are auditing a generated skill.md against the source timeline.

Find:
- unsupported claims
- invented UI buttons
- missing timestamps
- unclear steps
- wrong order of operations
- excessive summarization
- missing uncertainty notes
- procedures based only on audio when screenshots were necessary

Return strict JSON only:
{
  "score": number (0-100),
  "issues": [{ "severity": "low"|"medium"|"high", "problem": string, "timestamp": number|null, "recommended_fix": string }],
  "corrected_skill_md": string | null
}

Set "corrected_skill_md" to a fully corrected version of the skill.md only if there are medium/high issues; otherwise null.

SKILL.MD:
${args.skillMd}

TIMELINE:
${args.timelineJson}`;
