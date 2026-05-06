// LLM_API_KEY を dynamic import より前に設定（CI 環境での初期化 fail-fast 回避）
process.env.LLM_API_KEY ??= "test-key";

import { beforeEach, describe, expect, mock, test } from "bun:test";

// SDK モック（bun:test が mock.module を import より前に処理する）
class FakeAPIError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "APIError"; // スタックトレース向け（instanceof はプロトタイプチェーンで判定）
  }
}

const mockStreamFn = mock();
let capturedClientOptions: Record<string, unknown> = {};

// static APIError = FakeAPIError とすることで、プロダクションコードの
// `err instanceof Anthropic.APIError` がモック環境で FakeAPIError の instanceof 検査になる
mock.module("@anthropic-ai/sdk", () => {
  class FakeAnthropic {
    // getter で常に現在の mockStreamFn を参照する
    messages = {
      get stream() {
        return mockStreamFn;
      },
    };

    constructor(opts: Record<string, unknown>) {
      capturedClientOptions = opts;
    }

    static APIError = FakeAPIError;
  }

  return { default: FakeAnthropic, APIError: FakeAPIError };
});

// SDK モック確立後にモジュールを dynamic import
const { LlmError, streamAgentMessage } = await import("./llm-client.ts");

// ---- ヘルパー ----

type FakeEvent =
  | {
      type: "content_block_delta";
      index: number;
      delta: { type: "text_delta"; text: string };
    }
  | { type: "message_stop" };

async function* fakeStream(events: FakeEvent[]) {
  for (const event of events) {
    yield event;
  }
}

const baseInput = Object.freeze({
  model: "claude-sonnet-4-6",
  system: "You are helpful",
  user: "Hello",
  temperature: 0.3,
  max_tokens: 100,
});

// ---- テスト ----

describe("streamAgentMessage", () => {
  beforeEach(() => {
    mockStreamFn.mockReset();
  });

  test("text_delta チャンクを順番に yield する", async () => {
    mockStreamFn.mockImplementation(() =>
      fakeStream([
        {
          type: "content_block_delta",
          index: 0,
          delta: { type: "text_delta", text: "Hello" },
        },
        {
          type: "content_block_delta",
          index: 0,
          delta: { type: "text_delta", text: " world" },
        },
        { type: "message_stop" },
      ]),
    );

    const chunks: string[] = [];
    for await (const chunk of streamAgentMessage(baseInput)) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual(["Hello", " world"]);
  });

  test("text_delta 以外のイベントは無視する", async () => {
    mockStreamFn.mockImplementation(() =>
      fakeStream([
        { type: "message_stop" },
        {
          type: "content_block_delta",
          index: 0,
          delta: { type: "text_delta", text: "ok" },
        },
      ]),
    );

    const chunks: string[] = [];
    for await (const chunk of streamAgentMessage(baseInput)) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual(["ok"]);
  });

  test("SDK APIError は LlmError('llm_error') に写像される", async () => {
    mockStreamFn.mockImplementation(() => {
      throw new FakeAPIError(400, "Bad request");
    });

    let caught: unknown;
    try {
      for await (const _chunk of streamAgentMessage(baseInput)) {
        // noop
      }
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(LlmError);
    const err = caught as InstanceType<typeof LlmError>;
    expect(err.failReason).toBe("llm_error");
    expect(err.message).toBe("LLM API error: Bad request");
    expect(err.name).toBe("LlmError");
    expect(err.cause).toBeInstanceOf(FakeAPIError);
  });

  test("AbortError は LlmError にせずそのまま再スローする（開始前中断）", async () => {
    const controller = new AbortController();
    controller.abort();

    mockStreamFn.mockImplementation(async function* (
      _body: unknown,
      opts: { signal?: AbortSignal },
    ) {
      if (opts?.signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      yield { type: "message_stop" };
    });

    let caught: unknown;
    try {
      for await (const _chunk of streamAgentMessage(
        baseInput,
        controller.signal,
      )) {
        // noop
      }
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(DOMException);
    expect((caught as DOMException).name).toBe("AbortError");
  });

  test("AbortError は LlmError にせずそのまま再スローする（ストリーム途中の中断）", async () => {
    const controller = new AbortController();

    mockStreamFn.mockImplementation(async function* () {
      yield {
        type: "content_block_delta",
        index: 0,
        delta: { type: "text_delta", text: "chunk1" },
      };
      controller.abort();
      throw new DOMException("Aborted", "AbortError");
    });

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
});

// capturedClientOptions はモジュールロード時（dynamic import）に1回だけ記録される
describe("クライアント初期化", () => {
  test("maxRetries=3 / timeout=120000 で初期化されている", () => {
    expect(capturedClientOptions).toMatchObject({
      apiKey: "test-key",
      maxRetries: 3,
      timeout: 120_000,
    });
  });

  // MVP: LLM_API_KEY 未設定時の fail-fast はモジュールキャッシュ制約により自動テスト不可。
  // 別ファイル（llm-client.env.test.ts）で独立プロセスとして検証が必要。手動確認事項。

  // MVP: LLM_BASE_URL 設定時の clientOptions.baseURL 付与も同様にモジュールキャッシュ制約で未カバー。
});
