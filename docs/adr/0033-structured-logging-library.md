# 0033. 構造化ロギングライブラリの選定（Pino 採用）

## Status

accepted

- 作成日: 2026-06-03
- 関連: Issue #236, 親 Issue #235, 補完 Issue #239（trace ID 伝搬）, ADR-0008（技術スタック）

## Context

apps/api のロギングは現状 `apps/api/src/index.ts` の `console.error` 3 箇所のみで、以下の問題がある（#235 の dev flow 調査で確認）:

- タイムスタンプ・ログレベル・構造化フィールドがなく、運用段階での問題追跡が困難
- 内部例外（500 / `internal_error`）を返す `onError` ハンドラがログを一切残していない
- request 単位の相関 ID がなく、1 リクエストに紐づくログを横断的に追えない

Hono には組み込みの `logger()` middleware があるが、これは HTTP method/path/status/latency をプレーンテキストで出力する dev 向けアクセスロガーであり、構造化 JSON・ログレベル・child logger・redact・出力先制御を持たない。アプリケーションログ基盤としては機能不足。

ランタイムは Bun。サーバサイド（apps/api）の構造化ログ基盤を確立することが本決定の対象で、フロントエンド（apps/web）の可観測性は #237（エラートラッキング）、engine/LLM への ID 伝搬は #239 の責務とし、本 ADR のスコープ外とする。

## Considered Alternatives

| 選択肢 | 評価 |
| --- | --- |
| **Pino**（採用） | Node/Bun 系のデファクト。JSON 構造化・child logger（context binding）・redact を標準装備。低オーバーヘッド（Winston 比 5-10x 高速）。Hono 統合事例が豊富。Bun でも default の JSON stdout 出力は問題なく動作する |
| LogTape | ゼロ依存・ランタイム非依存でライブラリ向き。ただし apps/api スコープでは Pino の実績・Hono 統合事例の豊富さに対する優位が小さい |
| Winston | 多機能だが Pino 比で低速。本プロジェクトの最小要件に対して過剰 |
| Hono 組み込み `logger()` のみ | アクセスログ専用。構造化・レベル・redact を持たずアプリログ基盤にならない |

## Decision

apps/api の構造化ロギングライブラリとして **Pino** を採用する。

- 出力は **JSON を stdout** へ。本番ログ収集はコンテナ標準出力経由を前提とする
- ログレベルは環境変数 `LOG_LEVEL`（既定 `info`、テスト時 `silent`）で制御する
- request 単位の相関は **`hono/request-id` middleware** が払い出す request-id を `logger.child({ requestId })` で bind し、Hono context に格納したアクセスログ・エラーログで用いる
- engine の fire-and-forget 経路（HTTP request コンテキスト外）は `executionId` を bind する
- redact: `authorization` ヘッダ等の機密フィールドを除外する
- **pino-pretty は in-process transport（worker thread）として使わない**。Bun での worker transport の不安定さを避けるため、開発時の整形は `bun run dev | pino-pretty` のパイプで行う

ログレベル・出力先・redact 方針の運用ガイドは `docs/design/logging.md` に記録する（設定値の SSoT は `apps/api/src/lib/logger.ts`）。

## Consequences

- apps/api のログが JSON 構造化され、ログレベル・タイムスタンプ・request-id が付与される。運用段階での問題追跡が可能になる
- `onError` の 500 経路でエラーが記録され、これまでの「ログなしで握り潰し」が解消される
- 依存が 1 つ増える（`pino`）。pino-pretty を in-process で使わない方針のため、開発時の整形はパイプ実行という一手間が必要になる
- logger は当面 apps/api ローカル（`src/lib/logger.ts`）に置く。agent-core はライブラリのため具体ロガーに依存させず、#239 では **engine に `Logger` interface を DI 注入する形（apps/api の Pino 実装が構造的に interface を満たす）を本命**とする。共有パッケージ化は複数 app が同一実装を共有する必要が出た場合のみ検討する（いずれも本 ADR の範囲外）。なお `packages/shared` は apps/web（ブラウザ）も import するため、Pino 実装をここへ置くと web バンドルに混入する点に留意する
- apps/web・packages/agent-core・packages/db は本決定のスコープ外。フロントの可観測性は #237、engine への伝搬は #239 で扱う
