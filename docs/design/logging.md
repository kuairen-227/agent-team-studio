# ロギング方針

apps/api の構造化ロギングの運用方針。ライブラリ選定の経緯は [ADR-0033](../adr/0033-structured-logging-library.md) を参照。

設定値（ログレベル既定・redact パス）の SSoT は `apps/api/src/lib/logger.ts`。本ドキュメントは方針と根拠を記述し、具体値はコードを参照する。

## ライブラリ

[Pino](https://github.com/pinojs/pino)。JSON 構造化・child logger・低オーバーヘッド。Hono 統合は `hono/request-id` middleware と組み合わせる。

## 出力先

JSON を **stdout** へ出力する。本番のログ収集はコンテナ標準出力経由を前提とする。

pino-pretty は in-process transport（worker thread）として**使わない**（Bun での不安定さを避けるため）。開発時に整形して読みたい場合はパイプで行う:

```bash
bun run dev | pino-pretty
```

## ログレベル

環境変数 `LOG_LEVEL` で制御する。

| 環境 | 既定 | 備考 |
| --- | --- | --- |
| 通常 | `info` | |
| テスト（`NODE_ENV=test`） | `silent` | ログ出力でテスト結果を汚さないため |

`LOG_LEVEL` を明示指定した場合はそれが最優先。

## request 相関 / trace ID（request-id）

`hono/request-id` middleware が request ごとに request-id を払い出し（レスポンスヘッダ `X-Request-Id` にも付与）、それを bind した child logger を Hono context に格納する。アクセスログ・エラーログはこの request-scoped logger を用いるため、1 リクエストに紐づくログを request-id で横断的に追える。

`POST /api/executions` の request-id は **trace ID** として engine の fire-and-forget 経路（HTTP request コンテキスト外）へ伝搬する（[Issue #239](https://github.com/kuairen-227/agent-team-studio/issues/239)）。engine 起動時に `{ component: "engine", requestId, executionId }` を bind した child logger を生成し、agent ごとに `{ agentExecutionId, agentId, role }` を追加 bind した child を LLM 呼び出し層まで引き渡す。これにより HTTP→engine→agent→LLM のログを同一 trace ID で横断追跡できる。

内部エラー（500）応答では原因情報を返さず、相関用に `details.traceId`（= request-id）のみを露出する（`packages/shared` の `ApiInternalError`）。

### trace ID の生成方針

| 項目 | 内容 |
| --- | --- |
| 生成 | `hono/request-id` の既定ジェネレータ `crypto.randomUUID()` |
| 形式・長さ | RFC 4122 v4 UUID（36 文字、ハイフン区切り） |
| 外部指定 | クライアントが `X-Request-Id` を送ると踏襲する。ただし 255 文字超または `\w` `-` `=` 以外を含む値は破棄して再生成（hono の既定検証） |
| 衝突対策 | v4 は 122 bit ランダムで衝突確率は実質無視できる。短縮 ID は採用しない |

> **命名の対応**: ログのフィールド名は `requestId`、API エラー応答の契約名は `details.traceId`、HTTP ヘッダは `X-Request-Id`。いずれも同一の値を指す。
>
> **エラー応答時のアクセスログ**: throw 経路（`onError` で整形される 400 / 404 / 500、および未マッチルートの `onNotFound`）でもアクセスログ（`"request completed"`）を 1 リクエスト 1 行で出力し、`status` は実レスポンスと一致する。Hono の `compose` は throw を捕捉した階層内で `onError` を同期実行して `c.res` を確定するため、アクセスログ middleware の `await next()` 完了後の出力時点で status は反映済みになる（[Issue #256](https://github.com/kuairen-227/agent-team-studio/issues/256)）。500 はこれに加え `onError` の error ログでも追跡できる。退行検知は `apps/api/src/app.test.ts` のアクセスログ全経路テストで担保する。

## redact（機密フィールド除外）

認証情報（`req.headers.authorization` / `cookie`）と、機密フィールド名（`apiKey` / `api_key` / `token` / `password`）を**トップレベルおよび 1 階層下**でログ出力から除外する（`[REDACTED]` に置換）。除外パスの具体定義は `apps/api/src/lib/logger.ts` の `redact.paths` を参照。

> **深度の制約**: pino の redact パスの `*` は単一階層ワイルドカードで再帰（`**`）に非対応。そのため任意深度の機密フィールドは自動では落ちない。深くネストしたオブジェクトをログする場合は、ログ前に該当フィールドを除去するか、明示パスを追加すること。
>
> **メッセージ本文の制約**: redact はフィールド名（キー）ベースのため、`err.message` 等の文字列内に混入した機密は除去できない。DB ドライバが接続文字列をエラーメッセージに含める等、エラーメッセージに機密が混入しうる場合は、`{ err }` でそのまま渡さず message を加工してからログすること。

## スコープ外

- **apps/web**（ブラウザ）: フロントの可観測性は別途エラートラッキング（[Issue #237](https://github.com/kuairen-227/agent-team-studio/issues/237)）で扱う。
- **packages/agent-core**（engine/LLM）: ライブラリのため具体ロガーに依存させない。最小 Logger ポート型（`logger-port.ts`）を定義し、apps/api が Pino logger を child binding して注入する（#239 で実装済み）。
- **packages/db**: CLI スクリプト（migrate / seed）は人間が直接実行する運用ツールのため、構造化ログの対象外。
- **WebSocket ハンドラ**: `onOpen` / `onMessage` 等は Hono の request context 外で動作するため request-scoped logger の対象外（現状エラーはログに残らない）。WS の可観測性は必要になった時点で別途検討する。
