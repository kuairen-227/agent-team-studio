// provider キーを dynamic import より前に設定（モジュールロード時の fail-fast 回避）
process.env.ANTHROPIC_API_KEY ??= "test-anthropic-key";

import { beforeEach, describe, expect, mock, test } from "bun:test";

// ---- AI SDK モック（bun:test が mock.module を import より前に処理する）----

// AI SDK の APICallError 相当。プロダクションコードの `APICallError.isInstance(err)` が
// モック環境でこのクラスの判定になるよう static isInstance を備える。
class FakeAPICallError extends Error {
  static isInstance(err: unknown): err is FakeAPICallError {
    return err instanceof FakeAPICallError;
  }

  constructor(message: string) {
    super(message);
    this.name = "AI_APICallError";
  }
}

const mockStreamText = mock();
let capturedRegistryConfig: Record<string, unknown> = {};

mock.module("ai", () => ({
  streamText: (opts: unknown) => mockStreamText(opts),
  // languageModel は id をそのまま反射し、streamText 呼び出しの model 検証に使う
  createProviderRegistry: (config: Record<string, unknown>) => {
    capturedRegistryConfig = config;
    return { languageModel: (id: string) => ({ __modelId: id }) };
  },
  APICallError: FakeAPICallError,
}));

// provider パッケージは識別用センチネルを返すだけのスタブ
mock.module("@ai-sdk/anthropic", () => ({
  createAnthropic: () => ({ __provider: "anthropic" }),
}));
mock.module("@ai-sdk/groq", () => ({
  createGroq: () => ({ __provider: "groq" }),
}));

// SDK モック確立後にモジュールを dynamic import
const { streamAgentMessage } = await import("./llm-client.ts");
const { LlmError } = await import("./llm-error.ts");

// ---- ヘルパー ----

async function* fromChunks(chunks: string[]) {
  for (const chunk of chunks) {
    yield chunk;
  }
}

/** streamText の戻り値（textStream を持つ）を模す。 */
function streamResult(chunks: string[]) {
  return { textStream: fromChunks(chunks) };
}

/** 反復開始時にエラーを投げる textStream を模す（generator を使わず useYield を回避）。 */
function throwingStream(error: Error): AsyncIterable<string> {
  return {
    [Symbol.asyncIterator]() {
      return { next: () => Promise.reject(error) };
    },
  };
}

const baseInput = Object.freeze({
  model: "anthropic:claude-sonnet-4-6",
  system: "You are helpful",
  user: "Hello",
  temperature: 0.3,
  max_tokens: 100,
});

async function collect(stream: AsyncIterable<string>): Promise<string[]> {
  const chunks: string[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return chunks;
}

// ---- テスト ----

describe("streamAgentMessage", () => {
  beforeEach(() => {
    mockStreamText.mockReset();
  });

  test("textStream の文字列を順番にそのまま yield する", async () => {
    // text_delta 抽出は AI SDK が内部で行うため、textStream は文字列を直接流す
    mockStreamText.mockImplementation(() => streamResult(["Hello", " world"]));

    expect(await collect(streamAgentMessage(baseInput))).toEqual([
      "Hello",
      " world",
    ]);
  });

  test("APICallError は LlmError('llm_error') に写像される", async () => {
    mockStreamText.mockImplementation(() => ({
      textStream: throwingStream(new FakeAPICallError("Bad request")),
    }));

    let caught: unknown;
    try {
      await collect(streamAgentMessage(baseInput));
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(LlmError);
    const err = caught as InstanceType<typeof LlmError>;
    expect(err.failReason).toBe("llm_error");
    expect(err.message).toBe("LLM API error: Bad request");
    expect(err.name).toBe("LlmError");
    expect(err.cause).toBeInstanceOf(FakeAPICallError);
  });

  test("AbortError は LlmError にせずそのまま再スローする（開始前中断）", async () => {
    const controller = new AbortController();
    controller.abort();

    mockStreamText.mockImplementation(
      (opts: { abortSignal?: AbortSignal }) => ({
        get textStream() {
          return (async function* () {
            if (opts?.abortSignal?.aborted) {
              throw new DOMException("Aborted", "AbortError");
            }
            yield "unreachable";
          })();
        },
      }),
    );

    let caught: unknown;
    try {
      await collect(streamAgentMessage(baseInput, controller.signal));
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(DOMException);
    expect((caught as DOMException).name).toBe("AbortError");
  });

  test("AbortError は LlmError にせずそのまま再スローする（ストリーム途中の中断）", async () => {
    const controller = new AbortController();

    mockStreamText.mockImplementation(() => ({
      get textStream() {
        return (async function* () {
          yield "chunk1";
          controller.abort();
          throw new DOMException("Aborted", "AbortError");
        })();
      },
    }));

    const chunks: string[] = [];
    let caught: unknown;
    try {
      for await (const chunk of streamAgentMessage(
        baseInput,
        controller.signal,
      )) {
        chunks.push(chunk);
      }
    } catch (err) {
      caught = err;
    }

    expect(chunks).toEqual(["chunk1"]);
    expect(caught).toBeInstanceOf(DOMException);
    expect((caught as DOMException).name).toBe("AbortError");
  });

  test("LlmInput を streamText パラメータへ正しく写像する", async () => {
    let captured: Record<string, unknown> | undefined;
    mockStreamText.mockImplementation((opts: Record<string, unknown>) => {
      captured = opts;
      return streamResult([]);
    });

    await collect(streamAgentMessage(baseInput));

    expect(captured).toMatchObject({
      system: "You are helpful",
      prompt: "Hello",
      temperature: 0.3,
      maxOutputTokens: 100,
      maxRetries: 3,
      timeout: 120_000,
    });
    // model は registry.languageModel(`provider:model`) の解決結果
    expect(captured?.model).toEqual({
      __modelId: "anthropic:claude-sonnet-4-6",
    });
  });

  test("provider プレフィックス無しの model は LlmError('llm_error') になる", async () => {
    mockStreamText.mockImplementation(() => streamResult([]));

    let caught: unknown;
    try {
      await collect(
        streamAgentMessage({ ...baseInput, model: "claude-sonnet-4-6" }),
      );
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(LlmError);
    expect((caught as InstanceType<typeof LlmError>).failReason).toBe(
      "llm_error",
    );
  });

  test("未知の provider を指定した model は LlmError('llm_error') になる", async () => {
    mockStreamText.mockImplementation(() => streamResult([]));

    let caught: unknown;
    try {
      await collect(
        streamAgentMessage({ ...baseInput, model: "openai:gpt-4o" }),
      );
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(LlmError);
    expect((caught as InstanceType<typeof LlmError>).failReason).toBe(
      "llm_error",
    );
  });
});

// capturedRegistryConfig は llm-client.ts のモジュールロード時に記録される
describe("provider レジストリ初期化", () => {
  test("anthropic / groq provider が登録されている", () => {
    expect(Object.keys(capturedRegistryConfig).sort()).toEqual([
      "anthropic",
      "groq",
    ]);
  });

  // MVP: provider キー未設定時の fail-fast はモジュールキャッシュ制約により自動テスト不可。
  // 別ファイル（独立プロセス）での検証が必要。手動確認事項。
});
