import { describe, expect, test } from "bun:test";
import {
  createDedupedWebSearch,
  createTavilyWebSearch,
  type WebSearchOutcome,
  type WebSearchPort,
} from "./web-search-client.ts";

// ---- createTavilyWebSearch ----

describe("createTavilyWebSearch", () => {
  test("検索成功時は results を {title,url,snippet} に正規化して ok を返す", async () => {
    const port = createTavilyWebSearch({
      apiKey: "test",
      _rawSearch: async () => [
        { title: "T1", url: "https://example.com/1", content: "本文1" },
        { title: "T2", url: "https://example.com/2", content: "本文2" },
      ],
    });

    const outcome = await port.search("CompanyA 戦略");

    expect(outcome).toEqual({
      status: "ok",
      results: [
        { title: "T1", url: "https://example.com/1", snippet: "本文1" },
        { title: "T2", url: "https://example.com/2", snippet: "本文2" },
      ],
    });
  });

  test("ゼロ件でも ok（空配列）を返す（縮退判断は呼び出し側）", async () => {
    const port = createTavilyWebSearch({
      apiKey: "test",
      _rawSearch: async () => [],
    });

    const outcome = await port.search("存在しない企業");

    expect(outcome).toEqual({ status: "ok", results: [] });
  });

  test("常に失敗する場合はリトライ後 unavailable を返し、実行を中断させない", async () => {
    let calls = 0;
    const port = createTavilyWebSearch({
      apiKey: "test",
      maxRetries: 2,
      baseDelayMs: 1,
      _rawSearch: async () => {
        calls += 1;
        throw new Error("429 rate limit");
      },
    });

    const outcome = await port.search("CompanyA");

    expect(outcome.status).toBe("unavailable");
    if (outcome.status === "unavailable") {
      expect(outcome.reason).toContain("429");
    }
    // maxRetries=2 → 初回 + リトライ 2 回 = 3 回
    expect(calls).toBe(3);
  });

  test("一度失敗しても指数バックオフでリトライして成功する", async () => {
    let calls = 0;
    const port = createTavilyWebSearch({
      apiKey: "test",
      maxRetries: 2,
      baseDelayMs: 1,
      _rawSearch: async () => {
        calls += 1;
        if (calls === 1) throw new Error("transient");
        return [{ title: "T", url: "https://x.test", content: "c" }];
      },
    });

    const outcome = await port.search("CompanyA");

    expect(outcome.status).toBe("ok");
    expect(calls).toBe(2);
  });

  test("呼び出し前に signal が中断済みなら検索せず unavailable を返す", async () => {
    let calls = 0;
    const controller = new AbortController();
    controller.abort();
    const port = createTavilyWebSearch({
      apiKey: "test",
      _rawSearch: async () => {
        calls += 1;
        return [];
      },
    });

    const outcome = await port.search("CompanyA", controller.signal);

    expect(outcome.status).toBe("unavailable");
    expect(calls).toBe(0);
  });

  test("失敗後のバックオフ sleep 中に abort されると次の試行でループを抜ける", async () => {
    let calls = 0;
    const controller = new AbortController();
    const port = createTavilyWebSearch({
      apiKey: "test",
      maxRetries: 5,
      baseDelayMs: 50,
      _rawSearch: async () => {
        calls += 1;
        // 1 回目失敗 → sleep に入った直後に abort し、次の試行開始前に中断させる
        controller.abort();
        throw new Error("transient");
      },
    });

    const outcome = await port.search("CompanyA", controller.signal);

    expect(outcome.status).toBe("unavailable");
    // 初回のみ実行され、sleep 中 abort により以降の試行は走らない
    expect(calls).toBe(1);
  });
});

// ---- createDedupedWebSearch ----

describe("createDedupedWebSearch", () => {
  test("同一クエリは inner を 1 回だけ呼び、結果を共有する", async () => {
    let calls = 0;
    const inner: WebSearchPort = {
      search: async (): Promise<WebSearchOutcome> => {
        calls += 1;
        return {
          status: "ok",
          results: [{ title: "T", url: "u", snippet: "s" }],
        };
      },
    };
    const deduped = createDedupedWebSearch(inner);

    const [a, b] = await Promise.all([
      deduped.search("同一クエリ"),
      deduped.search("同一クエリ"),
    ]);

    expect(calls).toBe(1);
    expect(a).toEqual(b);
  });

  test("異なるクエリは inner を個別に呼ぶ", async () => {
    let calls = 0;
    const inner: WebSearchPort = {
      search: async (
        _query: string,
        _signal?: AbortSignal,
      ): Promise<WebSearchOutcome> => {
        calls += 1;
        return { status: "ok", results: [] };
      },
    };
    const deduped = createDedupedWebSearch(inner);

    await deduped.search("クエリ1");
    await deduped.search("クエリ2");

    expect(calls).toBe(2);
  });

  test("失敗（unavailable）はキャッシュせず、後続の同一クエリで再試行する", async () => {
    let calls = 0;
    const inner: WebSearchPort = {
      search: async (): Promise<WebSearchOutcome> => {
        calls += 1;
        // 1 回目は失敗、2 回目は成功
        return calls === 1
          ? { status: "unavailable", reason: "429" }
          : { status: "ok", results: [{ title: "T", url: "u", snippet: "s" }] };
      },
    };
    const deduped = createDedupedWebSearch(inner);

    const first = await deduped.search("同一クエリ");
    const second = await deduped.search("同一クエリ");

    expect(first.status).toBe("unavailable");
    expect(second.status).toBe("ok");
    // 失敗はネガティブキャッシュされないため再試行され、計 2 回呼ばれる
    expect(calls).toBe(2);
  });

  test("成功キャッシュ後は 2 回目が abort 済み signal でもキャッシュ結果を返す", async () => {
    let calls = 0;
    const inner: WebSearchPort = {
      search: async (): Promise<WebSearchOutcome> => {
        calls += 1;
        return {
          status: "ok",
          results: [{ title: "T", url: "u", snippet: "s" }],
        };
      },
    };
    const deduped = createDedupedWebSearch(inner);

    const first = await deduped.search("同一クエリ");
    const aborted = new AbortController();
    aborted.abort();
    const second = await deduped.search("同一クエリ", aborted.signal);

    // 2 回目の signal は無視され、1 回目の成功キャッシュが共有される
    expect(calls).toBe(1);
    expect(second).toEqual(first);
  });
});
