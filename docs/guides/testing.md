# テスト運用ガイド

判断軸（価値あるテストとは何か / アンチパターン）は [principles/testing.md](../principles/testing.md) を SSoT とする。本書は本プロジェクト固有の配置・モック戦略・ひな型を扱う。

## ファイル配置（co-location）

テスト対象と同ディレクトリに `*.test.ts` を置く。`tests/` や `test/fixtures/` のような最上位フォルダは作らない（テスト対象との関係が読み取れなくなるため）。

## カバレッジ運用

数値目標ではなく **「Service 層は必ずテストを書く」** ルール（[principles/testing.md §1.3](../principles/testing.md)）。Coverage 数値追求は同 §3 アンチパターン #4 と整合させて避ける。

## Service テストの Repository モック

関数注入（`createXxxService({ ... })`）した repo 関数をテスト内で `async () => fixture` 等のインラインモックに差し替える。MSW や jest mocks のような重量級ツールは MVP では導入しない。

## Route 層 (`app.request()`) の統合テスト

app の構築を `createApp(deps)` 関数で関数化し、テストでは fake repo を渡して DB 不要で Hono の route → service → repo を貫通させる。テスト用 DB を立ち上げる方式は I/O が重いため MVP では採用せず、必要が確定した時点（CRUD が増え DB 制約検証が要る US-2 以降）で testcontainers 等を再検討する。

## フィクスチャ配置方針

3 つのパターンを使い分ける。共有用の最上位フォルダは作らない。

| 配置 | 用途 |
| --- | --- |
| インライン（テスト内に literal） | 1 ケース限定の小さな fixture |
| `__fixtures__/`（同ディレクトリ） | 同フォルダ内の複数テストで共有する fixture |
| パッケージ内 `_test-fixtures.ts` | パッケージ横断（複数ファイル）で共有する fixture。`_` プレフィックスでテスト専用と明示 |

`apps/api/src/_test-fixtures.ts`（PR #125 で導入）が 3 つ目の最小サンプル。

## ひな型サンプル

| 用途 | 参照先 |
| --- | --- |
| Service 単体テスト | `apps/api/src/services/templates.test.ts` |
| Route 統合テスト | `apps/api/src/app.test.ts` |
| パッケージ共有 fixture | `apps/api/src/_test-fixtures.ts` |

## Web 層テスト（Testing Trophy）

判定軸は [principles/testing.md](../principles/testing.md)、比率モデルは Testing Trophy（[ADR-0036](../adr/0036-web-layer-testing-trophy.md)）。`apps/web` の現状は純粋ロジック・reducer の `bun:test` ユニットのみで、コンポーネント・結合テストは下記トリガ成立時に導入する（実装は本 doc 整備時点ではスコープ外）。

### do / don't

| テストする (do) | テストしない (don't) |
| --- | --- |
| ユーザー操作 → 表示の結合（フォーム送信 → 結果表示、取得 → 一覧描画） | className・DOM 構造・個別スタイル |
| 分岐を持つフック（取得状態・エラー・空表示の出し分け。`renderHook` 単体またはコンポーネント統合） | TanStack Query/Router 自体の挙動（ライブラリを信頼する） |
| 取得失敗・空・ローディングの 3 状態 | コンポーネント内部 state・実装詳細（リファクタで壊れる） |
| 純粋ロジック・reducer（現状どおり `bun:test` を維持） | スナップショット（経路独立性違反、principles「採用しない概念」） |

static 層（TypeScript strict + Biome）はテストを書かずに担保する（principles の「テストを書かない」正当化軸の 1 つ）。要素はロール・テキストから観測する（`screen.getByRole` 等）。DOM 構造ではなく画面の振る舞いを assert する。

### ツール（導入時）

vitest + React Testing Library + MSW + jsdom（DOM 実装の既定。実行速度が課題になれば happy-dom を検討）。MSW でネットワーク境界をモックし、`fetch` や `lib/api.ts` 自体はモックしない（[principles §3 過剰モック](../principles/testing.md) 回避）。これは**コンポーネント・結合テストの指針**であり、`lib/api.ts` / `lib/sentry.ts` *自体*のユニットテストが `fetch`・SDK を外部 I/O 境界として stub するのは別レイヤーとして可（現状の `api.test.ts` / `sentry.test.ts` がこれ）。純粋ロジック・ユニットの `bun:test` は維持し、コンポーネント・結合のみ vitest に載せる。

### TanStack Query の推奨パターン

- テストごとに新しい `QueryClient` を生成し `retry: false`・`gcTime: 0` にする（リトライ待ちの遅延を防ぎ、テスト間でキャッシュが残って後続が古い値で誤 pass するのを防ぐ＝FIRST の Independent）。再取得を検証するテストでは `staleTime: 0` も付ける
- `QueryClientProvider`（必要なら `RouterProvider`）でラップする共有ヘルパを用意する
- 非同期表示は `findBy*` / `waitFor` で待つ

```tsx
// _test-utils.tsx（テスト専用ヘルパ）
function createTestQueryClient() {
  return new QueryClient({
    // retry: false でリトライ遅延を排し、gcTime: 0 でテスト間のキャッシュ残留を防ぐ
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
}

export function renderWithClient(ui: ReactElement) {
  const client = createTestQueryClient();
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  );
}
```

フック単体は `renderHook` を同じ wrapper で検証する:

```tsx
const { result } = renderHook(() => useTemplates(), {
  wrapper: ({ children }) => (
    <QueryClientProvider client={createTestQueryClient()}>
      {children}
    </QueryClientProvider>
  ),
});
await waitFor(() => expect(result.current.isSuccess).toBe(true));
```

### 実装フェーズ移行トリガ

いずれか成立で vitest + RTL + MSW を導入し、結合テストを書き始める（複数該当なら優先度高）:

- フォーム・データ取得を含む新規画面/機能が追加される（US-2 以降の CRUD 拡張等）
- Playwright MCP の手動確認だけでは回帰を捕捉しきれない結合バグが発生した
- コンポーネント/フックの分岐ロジックが増え、純粋関数への切り出しだけでは検証しきれない
- 画面数が増え、E2E 見送りの前提（少数画面・手動確認で十分）が崩れる

導入時は本セクションと上記「ひな型サンプル」表に Web の参照先を追記する。

## UI 動作検証

Playwright MCP は**開発時に Claude が動作確認するためのツール**であり自動テストではない（[ai-ui-verification.md](./ai-ui-verification.md)）。受入条件の再現確認に使う。自動テストの方針は上記「Web 層テスト（Testing Trophy）」を参照する。
