import "server-only";
import Anthropic from "@anthropic-ai/sdk";

// All AI assists run through Claude. The model is fixed here so it's easy to
// change in one place. Opus 4.8 is used by default; switch to claude-haiku-4-5
// here if you want to trade some quality for lower cost/latency.
const MODEL = "claude-opus-4-8";

// AI features are optional: they only work when ANTHROPIC_API_KEY is set in the
// environment. Pages check this to hide the controls when it's missing.
export function aiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export class AiNotConfiguredError extends Error {
  constructor() {
    super("ANTHROPIC_API_KEY is not set");
    this.name = "AiNotConfiguredError";
  }
}

// Shared result shape for AI server actions consumed via useActionState.
export type AiError = "no_ai" | "no_data" | "failed" | "forbidden";
export interface AiState {
  text?: string;
  error?: AiError;
}

// One-shot text generation: a stable (cacheable) system prompt + a per-request
// user prompt. Thinking is disabled — these are short, simple summaries — so we
// instruct the model to reply with the answer only. Returns the plain text.
export async function generateText({
  system,
  prompt,
  maxTokens = 900,
}: {
  system: string;
  prompt: string;
  maxTokens?: number;
}): Promise<string> {
  if (!aiConfigured()) throw new AiNotConfiguredError();

  const client = new Anthropic();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    thinking: { type: "disabled" },
    system: [
      {
        type: "text",
        text: system,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: prompt }],
  });

  return response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
}
