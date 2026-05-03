// Issue #81 Spike: @anthropic-ai/sdk v0.92 の messages.stream() + AbortSignal を検証。
// 検証ポイント:
//   1. AbortSignal を渡し、abort() で即時中断されるか
//   2. 中断時の例外型 (期待: APIUserAbortError)
//   3. 3 階層タイムアウト (LLM 単体 / エージェント / Execution 全体) を AbortSignal.any で合成可能か
//
// 実行: ANTHROPIC_API_KEY=... bun run llm-spike.ts
import Anthropic, { APIUserAbortError } from "@anthropic-ai/sdk";

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error("ANTHROPIC_API_KEY is not set");
  process.exit(1);
}

const client = new Anthropic({ apiKey, maxRetries: 3 });

// agent-execution.md §7 準拠の値 (Spike 用に短縮)
const TIMEOUT_LLM_MS = 120_000;
const TIMEOUT_AGENT_MS = 800; // 本番 300s。Spike では 800ms に短縮し、3 階層中の最短として当選するか観測
const TIMEOUT_EXECUTION_MS = 10_000; // 本番 1500s。Spike では 10s に短縮

const MODEL = "claude-haiku-4-5-20251001"; // 検証コスト最小化のため Haiku 利用
const PROMPT =
  "1 から 200 までの数字を、各行に 1 つずつゆっくり丁寧に説明しながら出力してください。";

type Outcome = {
  case: string;
  durationMs: number;
  chunkCount: number;
  totalChars: number;
  errorName: string | null;
  errorMessage: string | null;
  isUserAbortError: boolean;
};

async function streamWithSignal(
  caseName: string,
  signal: AbortSignal,
  chunkLimit?: number,
): Promise<Outcome> {
  const start = Date.now();
  let chunkCount = 0;
  let totalChars = 0;
  try {
    const stream = client.messages.stream(
      {
        model: MODEL,
        max_tokens: 2048,
        temperature: 0.3,
        messages: [{ role: "user", content: PROMPT }],
      },
      { signal },
    );
    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        chunkCount += 1;
        totalChars += event.delta.text.length;
        if (chunkLimit && chunkCount >= chunkLimit) {
          // SDK 自身の abort() メソッドの動作も併せて確認
          stream.abort();
        }
      }
    }
    return {
      case: caseName,
      durationMs: Date.now() - start,
      chunkCount,
      totalChars,
      errorName: null,
      errorMessage: null,
      isUserAbortError: false,
    };
  } catch (err) {
    const e = err as Error;
    return {
      case: caseName,
      durationMs: Date.now() - start,
      chunkCount,
      totalChars,
      errorName: e.constructor.name,
      errorMessage: e.message,
      isUserAbortError: err instanceof APIUserAbortError,
    };
  }
}

const results: Outcome[] = [];

// --- Case 1: AbortController.abort() で外部中断 (~500ms 後)
console.log("=== Case 1: external AbortController.abort() ===");
{
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 500);
  results.push(await streamWithSignal("1:external-abort", ac.signal));
  clearTimeout(timer);
}

// --- Case 2: stream.abort() で SDK 経由の中断 (5 chunk 受信後)
console.log("=== Case 2: stream.abort() after 5 chunks ===");
{
  const ac = new AbortController();
  results.push(await streamWithSignal("2:stream-abort-after-5", ac.signal, 5));
}

// --- Case 3: AbortSignal.timeout() による単体タイムアウト (1s)
console.log("=== Case 3: AbortSignal.timeout(1000) ===");
results.push(
  await streamWithSignal("3:signal-timeout-1s", AbortSignal.timeout(1000)),
);

// --- Case 4: 3 階層 AbortSignal.any 合成 (Execution / Agent / LLM 単体)
//   - 最も短い AGENT signal が当選することを確認
console.log("=== Case 4: layered AbortSignal.any (3 layers) ===");
{
  const executionSignal = AbortSignal.timeout(TIMEOUT_EXECUTION_MS);
  const agentSignal = AbortSignal.timeout(TIMEOUT_AGENT_MS); // 最短: ここで abort されるはず
  const llmSignal = AbortSignal.timeout(TIMEOUT_LLM_MS);
  const composed = AbortSignal.any([executionSignal, agentSignal, llmSignal]);
  results.push(await streamWithSignal("4:any-3layers", composed));
}

// --- Case 5: 正常完了 (制御群: タイムアウトを大きく取り abort なし)
console.log(
  "=== Case 5: normal completion (control, max_tokens=64 で短縮) ===",
);
{
  const start = Date.now();
  let chunkCount = 0;
  let totalChars = 0;
  let errorName: string | null = null;
  let errorMessage: string | null = null;
  try {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 64,
      temperature: 0.3,
      messages: [{ role: "user", content: "hello を 3 回繰り返して" }],
    });
    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        chunkCount += 1;
        totalChars += event.delta.text.length;
      }
    }
  } catch (err) {
    const e = err as Error;
    errorName = e.constructor.name;
    errorMessage = e.message;
  }
  results.push({
    case: "5:normal-completion",
    durationMs: Date.now() - start,
    chunkCount,
    totalChars,
    errorName,
    errorMessage,
    isUserAbortError: false,
  });
}

console.log("\n=== Summary ===");
console.table(
  results.map((r) => ({
    case: r.case,
    ms: r.durationMs,
    chunks: r.chunkCount,
    chars: r.totalChars,
    errorName: r.errorName ?? "-",
    isUserAbortError: r.isUserAbortError,
  })),
);
