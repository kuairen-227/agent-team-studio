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

## UI 動作検証

React コンポーネントの単体テストは MVP 範囲外。代わりに Playwright MCP で受入条件を再現確認する。運用ルールは [ai-ui-verification.md](./ai-ui-verification.md) を参照。
