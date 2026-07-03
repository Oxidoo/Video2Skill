import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { config, Provider } from "./config";

let anthropicClient: Anthropic | null = null;
let openaiClient: OpenAI | null = null;

export function anthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set");
  return (anthropicClient ??= new Anthropic());
}

export function openai(): OpenAI {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not set");
  return (openaiClient ??= new OpenAI());
}

/** Extract the first JSON object from a model response that may include prose. */
export function extractJson(text: string): unknown {
  const cleaned = text.replace(/^```(?:json)?\s*/m, "").replace(/```\s*$/m, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object found in model response");
  return JSON.parse(cleaned.slice(start, end + 1));
}

export async function completeText(args: {
  provider: Provider;
  prompt: string;
  imagesBase64?: { data: string; mediaType: "image/png" }[];
  maxTokens?: number;
}): Promise<string> {
  const maxTokens = args.maxTokens ?? 8192;

  if (args.provider === "anthropic") {
    const content: Anthropic.ContentBlockParam[] = [
      ...(args.imagesBase64 ?? []).map(
        (img): Anthropic.ImageBlockParam => ({
          type: "image",
          source: { type: "base64", media_type: img.mediaType, data: img.data },
        })
      ),
      { type: "text", text: args.prompt },
    ];
    const model = args.imagesBase64?.length
      ? config.anthropicVisionModel
      : config.anthropicSynthesisModel;
    const response = await anthropic().messages.create({
      model,
      max_tokens: maxTokens,
      messages: [{ role: "user", content }],
    });
    return response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
  }

  const content: OpenAI.Chat.ChatCompletionContentPart[] = [
    ...(args.imagesBase64 ?? []).map(
      (img): OpenAI.Chat.ChatCompletionContentPart => ({
        type: "image_url",
        image_url: { url: `data:${img.mediaType};base64,${img.data}` },
      })
    ),
    { type: "text", text: args.prompt },
  ];
  const response = await openai().chat.completions.create({
    model: config.openaiVisionModel,
    max_completion_tokens: maxTokens,
    messages: [{ role: "user", content }],
  });
  return response.choices[0]?.message?.content ?? "";
}
