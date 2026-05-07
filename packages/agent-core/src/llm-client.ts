/**
 * Anthropic SDK の薄いラッパー。
 *
 * クライアントは lazy singleton で初回呼び出し時に初期化する。
 * モジュールロード時に副作用がないため、fake stream を DI するテストで
 * `LLM_API_KEY` 不要かつ `mock.module` が正しく適用される。
 * エラーは `LlmError` に統一し、AbortSignal による中断はそのまま伝播する。
 */

import type { AgentFailReason } from "@agent-team-studio/shared";
import Anthropic from "@anthropic-ai/sdk";

/** LLM 呼び出しのパラメータ（モデル・プロンプト・温度・トークン上限）。 */
export type LlmInput = {
  model: string;
  system: string;
  user: string;
  temperature: number;
  max_tokens: number;
};

/** LLM API 失敗を表すカスタムエラー。`failReason` で失敗の種別を識別する。 */
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

let _client: Anthropic | null = null;

/** 初回呼び出し時にクライアントを生成してキャッシュする。 */
function getClient(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) throw new Error("LLM_API_KEY is not set");
  const options: ConstructorParameters<typeof Anthropic>[0] = {
    apiKey,
    maxRetries: 3,
    timeout: 120_000,
  };
  if (process.env.LLM_BASE_URL) {
    options.baseURL = process.env.LLM_BASE_URL;
  }
  _client = new Anthropic(options);
  return _client;
}

/**
 * LLM からのテキストを非同期ストリームで返す。
 *
 * `signal` が中断されると AbortError（DOMException）がそのまま伝播する。
 * Anthropic SDK 例外は `LlmError` に変換して throw する。
 */
export async function* streamAgentMessage(
  input: LlmInput,
  signal?: AbortSignal,
): AsyncIterable<string> {
  const client = getClient();
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
