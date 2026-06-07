/**
 * JSON を fetch するユーティリティ。エラー時は `"status=NNN"` 形式でメッセージを throw する。
 * `main.tsx` の `QueryClient` retry 判定・Sentry 報告判定（`isExpectedClientError`）と対になっている。
 */
export async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`status=${res.status}`);
  return (await res.json()) as T;
}

/**
 * 想定内のクライアントエラー（4xx）かを判定する。
 *
 * `fetchJson` が投げる `"status=4NN"` 形式のメッセージを対象とする。retry しない判定と、
 * Sentry へ報告しない判定（想定内のため observability ノイズを避ける）の双方で共有する。
 */
export function isExpectedClientError(error: unknown): boolean {
  return error instanceof Error && /^status=4\d\d$/.test(error.message);
}
