import type { AgentFailReason } from "@agent-team-studio/shared";
import Anthropic from "@anthropic-ai/sdk";

export type LlmInput = {
  model: string;
  system: string;
  user: string;
  temperature: number;
  max_tokens: number;
};

export class LlmError extends Error {
  readonly failReason: AgentFailReason;

  constructor(
    failReason: AgentFailReason,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "LlmError";
    this.failReason = failReason;
  }
}

const apiKey = process.env.LLM_API_KEY;
if (!apiKey) {
  throw new Error("LLM_API_KEY is not set");
}

const clientOptions: ConstructorParameters<typeof Anthropic>[0] = {
  apiKey,
  maxRetries: 3,
  timeout: 120_000,
};

if (process.env.LLM_BASE_URL) {
  clientOptions.baseURL = process.env.LLM_BASE_URL;
}

const client = new Anthropic(clientOptions);

export async function* streamAgentMessage(
  input: LlmInput,
  signal?: AbortSignal,
): AsyncIterable<string> {
  try {
    const stream = client.messages.stream(
      {
        model: input.model,
        system: input.system,
        messages: [{ role: "user", content: input.user }],
        temperature: input.temperature,
        max_tokens: input.max_tokens,
      },
      { signal },
    );

    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        yield event.delta.text;
      }
    }
  } catch (err) {
    // APITimeoutError を含む SDK エラーを llm_error に統一。timeout 判断は engine 層の AbortSignal が担う
    if (err instanceof Anthropic.APIError) {
      throw new LlmError("llm_error", `LLM API error: ${err.message}`, {
        cause: err,
      });
    }
    // AbortError は DOMException として伝播する（Bun + @anthropic-ai/sdk の挙動）
    throw err;
  }
}
