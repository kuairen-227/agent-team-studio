/**
 * LLM クライアント（Vercel AI SDK Core ベース）。
 *
 * 公開境界（`LlmInput` → `AsyncIterable<string>`）は不変（ADR-0020 方針2）。内部実装のみ
 * `@anthropic-ai/sdk` 直叩きから AI SDK Core（`streamText` + provider registry）へ差し替えた
 * （ADR-0034）。provider は model 文字列の `provider:model` 接頭辞で解決し、将来の複数 provider
 * 同時利用に備える（例: `anthropic:claude-sonnet-4-6` / `groq:llama-3.3-70b-versatile`）。
 *
 * モジュールロード時に「最低 1 つの provider API キー」を検証する副作用がある。
 * エラーは `LlmError` に統一し、AbortSignal による中断はそのまま伝播する。
 */

import { createAnthropic } from "@ai-sdk/anthropic";
import { createGroq } from "@ai-sdk/groq";
import { APICallError, createProviderRegistry, streamText } from "ai";
import { LlmError } from "./llm-error.ts";

/** LLM 呼び出しのパラメータ（モデル・プロンプト・温度・トークン上限）。 */
export type LlmInput = {
  /** `provider:model` 形式（例 `anthropic:claude-sonnet-4-6`）。 */
  model: string;
  system: string;
  user: string;
  temperature: number;
  max_tokens: number;
};

/** SDK 内蔵リトライ回数（ADR-0020 方針4 / ADR-0034 で維持）。 */
const MAX_RETRIES = 3;

/** LLM 呼び出しのタイムアウト（ms）。engine 層 AbortSignal（AGENT_TIMEOUT_MS）のバックストップ。 */
const TIMEOUT_MS = 120_000;

/**
 * 登録 provider と対応する API キー環境変数名。
 * provider を増やす場合はここに 1 行追加し、`registry` にも provider を登録する。
 * 各 provider は apiKey 未指定時に AI SDK が標準 env（`ANTHROPIC_API_KEY` / `ANTHROPIC_BASE_URL` 等）を参照する。
 */
const PROVIDER_API_KEY_ENV = {
  anthropic: "ANTHROPIC_API_KEY",
  groq: "GROQ_API_KEY",
} as const;

type ProviderId = keyof typeof PROVIDER_API_KEY_ENV;

// モジュールロード時の fail-fast: 最低 1 つの provider キーがなければ起動を止める。
const hasAnyApiKey = Object.values(PROVIDER_API_KEY_ENV).some(
  (envName) => process.env[envName],
);
if (!hasAnyApiKey) {
  throw new Error(
    `No LLM provider API key is set. Set at least one of: ${Object.values(
      PROVIDER_API_KEY_ENV,
    ).join(", ")}`,
  );
}

// model 文字列 `provider:model` で言語モデルを解決するレジストリ（区切りは既定の ":"）。
const registry = createProviderRegistry({
  anthropic: createAnthropic(),
  groq: createGroq(),
});

/**
 * `provider:model` 文字列を言語モデルへ解決する。
 * 接頭辞が無い / 未登録 provider の場合は `LlmError('llm_error')` を投げる。
 */
function resolveLanguageModel(model: string) {
  const separatorIndex = model.indexOf(":");
  const providerId =
    separatorIndex === -1 ? "" : model.slice(0, separatorIndex);
  if (!(providerId in PROVIDER_API_KEY_ENV)) {
    throw new LlmError(
      "llm_error",
      `Unknown LLM provider in model "${model}". Expected "<provider>:<model>" with provider one of: ${Object.keys(
        PROVIDER_API_KEY_ENV,
      ).join(", ")}`,
    );
  }
  return registry.languageModel(model as `${ProviderId}:${string}`);
}

/**
 * LLM からのテキストを非同期ストリームで返す。
 *
 * `signal` が中断されると AbortError（DOMException）がそのまま伝播する。
 * AI SDK の API 例外（`APICallError`）は `LlmError` に変換して throw する。
 */
export async function* streamAgentMessage(
  input: LlmInput,
  signal?: AbortSignal,
): AsyncIterable<string> {
  try {
    const result = streamText({
      model: resolveLanguageModel(input.model),
      system: input.system,
      prompt: input.user,
      temperature: input.temperature,
      maxOutputTokens: input.max_tokens,
      maxRetries: MAX_RETRIES,
      timeout: TIMEOUT_MS,
      abortSignal: signal,
    });

    for await (const chunk of result.textStream) {
      yield chunk;
    }
  } catch (err) {
    // API 由来のエラーを llm_error に統一。timeout 判断は engine 層の AbortSignal が担う
    if (APICallError.isInstance(err)) {
      throw new LlmError("llm_error", `LLM API error: ${err.message}`, {
        cause: err,
      });
    }
    // AbortError（DOMException）/ 解決時の LlmError はそのまま伝播する
    throw err;
  }
}
