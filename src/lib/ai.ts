import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { AiRole, config, modelFor } from "./config";

let anthropicClient: Anthropic | null = null;
let openaiClient: OpenAI | null = null;

export function anthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set");
  return (anthropicClient ??= new Anthropic({
    timeout: config.apiTimeoutMs,
    maxRetries: config.apiMaxRetries,
  }));
}

export function openai(): OpenAI {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not set");
  return (openaiClient ??= new OpenAI({
    timeout: config.apiTimeoutMs,
    maxRetries: config.apiMaxRetries,
  }));
}

/**
 * Extract the first JSON object from a model response that may include prose.
 * Only a fallback: with a `jsonSchema` the providers return bare JSON, but a
 * model that ignores the constraint must not sink the frame.
 */
export function extractJson(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // Fall through to brace scanning.
  }
  const cleaned = trimmed
    .replace(/^```(?:json)?\s*/m, "")
    .replace(/```\s*$/m, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // Fall through to brace scanning.
  }

  // Scan for a balanced object rather than indexOf/lastIndexOf, which breaks as
  // soon as the model writes prose containing a brace after the JSON.
  const start = cleaned.indexOf("{");
  if (start === -1) throw new Error("No JSON object found in model response");
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return JSON.parse(cleaned.slice(start, i + 1));
    }
  }
  throw new Error("No balanced JSON object found in model response");
}

export type ImageInput = { data: string; mediaType: "image/jpeg" | "image/png" };

export interface JsonSchemaSpec {
  /** Schema name — OpenAI requires one; Anthropic ignores it. */
  name: string;
  schema: Record<string, unknown>;
}

export interface CompleteArgs {
  /** Pipeline stage — selects provider, model and token budget. */
  role: AiRole;
  /**
   * Static instructions. Kept byte-identical across calls so Anthropic can cache
   * the prefix: caching is a prefix match, so anything variable belongs in
   * `prompt`, never here.
   */
  system?: string;
  /** Per-call variable part of the prompt. */
  prompt: string;
  images?: ImageInput[];
  maxTokens?: number;
  /** When set, constrains the response to this schema instead of hoping for JSON. */
  jsonSchema?: JsonSchemaSpec;
  /** Overrides the role's default model (used for the high-resolution retry). */
  model?: string;
}

export async function completeText(args: CompleteArgs): Promise<string> {
  const resolved = modelFor(args.role);
  const model = args.model ?? resolved.model;
  const maxTokens = args.maxTokens ?? resolved.maxTokens;

  if (resolved.provider === "anthropic") {
    return completeAnthropic(args, model, maxTokens);
  }
  return completeOpenai(args, model, maxTokens);
}

async function completeAnthropic(
  args: CompleteArgs,
  model: string,
  maxTokens: number
): Promise<string> {
  const content: Anthropic.ContentBlockParam[] = [
    ...(args.images ?? []).map(
      (img): Anthropic.ImageBlockParam => ({
        type: "image",
        source: { type: "base64", media_type: img.mediaType, data: img.data },
      })
    ),
    { type: "text", text: args.prompt },
  ];

  // Render order is tools -> system -> messages, so a breakpoint at the end of
  // `system` caches the instructions across every frame even though the image
  // and the variable text differ each time.
  const system: Anthropic.TextBlockParam[] | undefined = args.system
    ? [
        {
          type: "text",
          text: args.system,
          ...(config.promptCaching ? { cache_control: { type: "ephemeral" as const } } : {}),
        },
      ]
    : undefined;

  const response = await anthropic().messages.create({
    model,
    max_tokens: maxTokens,
    ...(system ? { system } : {}),
    ...(args.jsonSchema && config.structuredOutputs
      ? { output_config: { format: { type: "json_schema" as const, schema: args.jsonSchema.schema } } }
      : {}),
    messages: [{ role: "user", content }],
  });

  return response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

async function completeOpenai(
  args: CompleteArgs,
  model: string,
  maxTokens: number
): Promise<string> {
  const content: OpenAI.Chat.ChatCompletionContentPart[] = [
    ...(args.images ?? []).map(
      (img): OpenAI.Chat.ChatCompletionContentPart => ({
        type: "image_url",
        image_url: { url: `data:${img.mediaType};base64,${img.data}` },
      })
    ),
    { type: "text", text: args.prompt },
  ];

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    ...(args.system
      ? [{ role: "system" as const, content: args.system }]
      : []),
    { role: "user" as const, content },
  ];

  const response = await openai().chat.completions.create({
    model,
    max_completion_tokens: maxTokens,
    ...(args.jsonSchema && config.structuredOutputs
      ? {
          response_format: {
            type: "json_schema" as const,
            json_schema: {
              name: args.jsonSchema.name,
              schema: args.jsonSchema.schema,
              strict: true,
            },
          },
        }
      : {}),
    messages,
  });

  return response.choices[0]?.message?.content ?? "";
}
