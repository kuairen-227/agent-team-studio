/**
 * Web 検索クライアント（Tavily ベース / アプリ層の検索境界）。
 *
 * ADR-0045 の方針に従い、検索境界を agent-core に薄い port として置く。`@tavily/core`
 * の import は本ファイルのみで行い（llm-client.ts と同じ境界集約の方針）、Exa 等への
 * 差し替えは本 adapter に局所化する。公開境界は `WebSearchPort`（`provider:model` の
 * ような実装詳細を漏らさず、ドメイン型 `WebSearchResult` / `WebSearchOutcome` で閉じる）。
 *
 * 失敗（429 / タイムアウト / API エラー）は例外で投げず `WebSearchOutcome` で表す。
 * 調査エージェントは出典取得不可を「握りつぶさず・実行を中断させず」knowledge_base へ
 * 縮退できる（ADR-0045 Decision 5・基準3 の主旨は検証可能性であり偽出典は不可）。
 *
 * SSoT: docs/adr/0045-web-search-api-selection.md
 */

import { tavily } from "@tavily/core";

/** 1 件の Web 検索結果（出典 URL 付き）。adapter が provider 応答を本型へ正規化する。 */
export type WebSearchResult = {
  title: string;
  url: string;
  snippet: string;
};

/**
 * 検索の成否を型で表す discriminated union。
 * - `ok`: 検索到達（0 件含む）。`results` が空なら呼び出し側が縮退判断する。
 * - `unavailable`: 429 / タイムアウト / API エラー / 中断。`reason` は診断・ログ用。
 */
export type WebSearchOutcome =
  | { status: "ok"; results: WebSearchResult[] }
  | { status: "unavailable"; reason: string };

/** Web 検索境界の port。Tavily 実装は {@link createTavilyWebSearch}。 */
export type WebSearchPort = {
  search: (query: string, signal?: AbortSignal) => Promise<WebSearchOutcome>;
};

/** provider 非依存の生検索シーム（テスト差し替え・adapter 再利用のため）。 */
type RawSearchResult = { title: string; url: string; content: string };
type RawSearch = (
  query: string,
  signal?: AbortSignal,
) => Promise<RawSearchResult[]>;

export type TavilyWebSearchOptions = {
  apiKey: string;
  /** 1 クエリあたりの最大取得件数（既定 5）。 */
  maxResults?: number;
  /** 失敗時の追加リトライ回数（既定 2 → 初回含め最大 3 試行）。 */
  maxRetries?: number;
  /** リトライ初回待機（ms・既定 500）。指数バックオフの基準値。テストで上書きする。 */
  baseDelayMs?: number;
  /** テスト用シーム: 実 SDK 呼び出しを差し替える。 */
  _rawSearch?: RawSearch;
};

// 1 クエリの取得件数。プロンプトへ注入する文脈サイズ（競合数×件数×スニペット長）と
// Tavily クレジット消費の双方を抑えるため 3 に抑える（ADR-0045 無料枠運用 / レビュー指摘 Must2）。
const DEFAULT_MAX_RESULTS = 3;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_BASE_DELAY_MS = 500;
/** バックオフ上限（ms）。エージェント単位タイムアウト内に収めるための保険。 */
const MAX_DELAY_MS = 4_000;

/** abort で早期解決する sleep（中断時は待たずに resolve し、呼び出し側が aborted を判定する）。 */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    const id = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(id);
      resolve();
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * 生検索結果を {@link WebSearchResult} へ正規化し、指数バックオフでリトライする port を作る。
 * Tavily 固有の応答整形・エラー写像はここに閉じ、`WebSearchPort` のみを公開する。
 */
function createWebSearchFromRaw(
  rawSearch: RawSearch,
  options: Pick<TavilyWebSearchOptions, "maxRetries" | "baseDelayMs">,
): WebSearchPort {
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const baseDelayMs = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;

  return {
    async search(query, signal): Promise<WebSearchOutcome> {
      let lastError = "";
      for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
        if (signal?.aborted)
          return { status: "unavailable", reason: "aborted" };
        try {
          const raw = await rawSearch(query, signal);
          return {
            status: "ok",
            results: raw.map((r) => ({
              title: r.title,
              url: r.url,
              snippet: r.content,
            })),
          };
        } catch (err) {
          lastError = err instanceof Error ? err.message : String(err);
          if (attempt < maxRetries) {
            const delay = Math.min(baseDelayMs * 2 ** attempt, MAX_DELAY_MS);
            await sleep(delay, signal);
          }
        }
      }
      return { status: "unavailable", reason: lastError || "search failed" };
    },
  };
}

/**
 * Tavily を用いた {@link WebSearchPort} を生成する。
 * `TAVILY_API_KEY` が設定されている場合のみ apps/api が呼び出して注入する
 * （未設定時は port を注入せず、調査エージェントは knowledge_base 動作へ縮退する）。
 */
export function createTavilyWebSearch(
  options: TavilyWebSearchOptions,
): WebSearchPort {
  const maxResults = options.maxResults ?? DEFAULT_MAX_RESULTS;

  const rawSearch: RawSearch =
    options._rawSearch ??
    (async (query) => {
      const client = tavily({ apiKey: options.apiKey });
      // searchDepth: "basic" は 1 クレジット相当（ADR-0045 無料枠運用）。
      const response = await client.search(query, {
        searchDepth: "basic",
        maxResults,
      });
      return response.results;
    });

  return createWebSearchFromRaw(rawSearch, options);
}

/**
 * 同一クエリの重複呼び出しを実行スコープで 1 回に畳む dedup ラッパ（ADR-0045 無料枠抑制）。
 * engine が runExecution ごとに生成し、並列調査エージェント間で共有する。
 * inflight の Promise を共有するため、同時発火する同一クエリも 1 回の検索に集約される。
 *
 * - **失敗はネガティブキャッシュしない**: `unavailable` や reject は cache から除去し、
 *   後続の同一クエリが再試行できるようにする（transient な 429 等で実行内の出典取得が
 *   恒久的に潰れるのを防ぐ — ADR-0045「出典取得可能性を最大化」）。成功（`ok`）のみ残す。
 * - **signal は最初の呼び出し元のものだけが `inner.search` に渡る**。2 番目以降の signal は
 *   無視される。engine 経路では全 Investigation Agent が同一 execution の AbortSignal を
 *   共有する前提のため実害はない（前提が崩れる構成で再利用する場合は要注意）。
 */
export function createDedupedWebSearch(inner: WebSearchPort): WebSearchPort {
  const cache = new Map<string, Promise<WebSearchOutcome>>();
  return {
    search(query, signal): Promise<WebSearchOutcome> {
      const cached = cache.get(query);
      if (cached) return cached;
      const pending = inner.search(query, signal);
      cache.set(query, pending);
      // 成功以外（unavailable / reject）は settle 後にキャッシュから除去して再試行を許す。
      // 同時発火中の共有は pending を返すことで担保済み（除去は次回以降にのみ影響する）。
      void pending.then(
        (outcome) => {
          if (outcome.status !== "ok") cache.delete(query);
        },
        () => {
          cache.delete(query);
        },
      );
      return pending;
    },
  };
}
