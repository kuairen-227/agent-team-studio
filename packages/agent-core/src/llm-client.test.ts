import { beforeEach, describe, expect, mock, test } from "bun:test";

// SDK モック（bun:test が mock.module を import より前に処理する）
class FakeAPIError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "APIError";
  }
}

const mockStreamFn = mock();
let constructorOptions: Record<string, unknown> = {};

mock.module("@anthropic-ai/sdk", () => {
  class FakeAnthropic {
    // getter で常に現在の mockStreamFn を参照する
    messages = {
      get stream() {
        return mockStreamFn;
      },
    };

    constructor(opts: Record<string, unknown>) {
      constructorOptions = opts;
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

const baseInput = {
  model: "claude-sonnet-4-6",
  system: "You are helpful",
  user: "Hello",
  temperature: 0.3,
  max_tokens: 100,
};

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

    await expect(async () => {
      for await (const _ of streamAgentMessage(baseInput)) {
        // noop
      }
    }).toThrow(LlmError);

    try {
      for await (const _ of streamAgentMessage(baseInput)) {
        // noop
      }
    } catch (err) {
      expect(err).toBeInstanceOf(LlmError);
      expect((err as InstanceType<typeof LlmError>).failReason).toBe(
        "llm_error",
      );
    }
  });

  test("AbortError は LlmError にせずそのまま再スローする", async () => {
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

    await expect(async () => {
      for await (const _ of streamAgentMessage(baseInput, controller.signal)) {
        // noop
      }
    }).toThrow(DOMException);
  });

  test("SDK クライアントが maxRetries=3 / timeout=120000 で初期化されている", () => {
    expect(constructorOptions).toMatchObject({
      maxRetries: 3,
      timeout: 120_000,
    });
  });
});
