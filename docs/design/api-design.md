# API 設計規約

ADR-0009 で決定した REST API の設計方針。WebSocket メッセージ契約は [websocket-design.md](./websocket-design.md) を参照。

## REST API

### URL 設計

リソース指向の URL 設計を採用する。

```text
GET    /api/templates          # テンプレート一覧
GET    /api/templates/:id      # テンプレート詳細

POST   /api/executions         # 実行開始
GET    /api/executions         # 実行履歴一覧
GET    /api/executions/:id     # 実行結果詳細
```

- リソース名は複数形（`templates`, `executions`）
- ネストは 1 階層まで（例: `/api/executions/:id/results`）
- 動詞は使わず、HTTP メソッドで操作を表現する

### HTTP メソッド

| メソッド | 用途 | 成功時ステータス |
| --- | --- | --- |
| GET | リソースの取得 | 200 |
| POST | リソースの作成 | 201（即時完了）/ 202（非同期処理開始） |

MVP では更新・削除は不要。必要になった時点で PUT/DELETE を追加する。

### レスポンス形式

すべて JSON。

**成功時:**

```json
{
  "id": "exec_abc123",
  "status": "running",
  "createdAt": "2026-04-17T10:00:00Z"
}
```

**一覧取得時:**

```json
{
  "items": [...],
  "total": 42
}
```

## エラーレスポンス

REST のエラーは「**リクエストが同期的に受理されなかった場合**」に限定する。`POST /api/executions` が 202 Accepted で受理された後に発生する LLM 失敗・エージェント実行タイムアウト・統合失敗等の**実行処理本体の失敗**は REST レスポンスに載らず、[websocket-design.md §エラーイベント](./websocket-design.md) の `execution:failed` / `agent:status status="failed"` 経由で通知される。

### 型（discriminated union）

`errorCode` フィールドで種別を識別する。本節は **暫定 SSoT** であり、実装後は `packages/shared/src/api-types.ts` を SSoT とする。

```typescript
// 暫定 SSoT。実装後は packages/shared/src/api-types.ts を SSoT とする。
type ApiError =
  | {
      errorCode: "validation_error";
      message: string;
      details: { field: string; reason: string }[];
    }
  | {
      errorCode: "not_found";
      message: string;
      details: { resource: "template" | "execution"; id: string };
    }
  | {
      errorCode: "internal_error";
      message: string;
      details?: { traceId?: string };
    };
```

- `message`: ユーザー向け表示文字列（1 行）。ローカライズ前提の語彙ではなく、暫定は日本語のそのまま表示可能な文面とする
- `details`: 機械可読メタデータ。`errorCode` 毎に形を固定し、フロント側で discriminated union のナローイング後にフィールドへアクセスできるようにする（自由形 `unknown` は採用しない）
- `internal_error.details` のみ任意。MVP では詳細漏洩防止のため省略を基本とし、将来のトレース導入時に `traceId` を返す余地を残す
- `not_found.details.resource` は MVP リソース（`template` / `execution`）に限定したリテラル union。新規リソース追加時は本定義の更新を強制する

### `errorCode` と HTTP ステータスの対応

| `errorCode` | HTTP | 用途 |
| --- | --- | --- |
| `validation_error` | 400 | 入力バリデーション失敗（Zod 等のスキーマ検証違反） |
| `not_found` | 404 | 指定リソース（`templateId` / `executionId`）が存在しない |
| `internal_error` | 500 | DB 接続エラー等のサーバ内部例外 |

MVP 認証なし（[websocket-design.md §接続](./websocket-design.md) と整合）のため 401 / 403 は定義しない。409 等も MVP のユースケース上発生しないため定義しない。必要になった時点で語彙を追加する。

### 例

```json
{
  "errorCode": "validation_error",
  "message": "入力に誤りがあります",
  "details": [
    { "field": "competitors", "reason": "1 件以上指定してください" },
    { "field": "perspectives", "reason": "許可されていない値が含まれています" }
  ]
}
```

```json
{
  "errorCode": "not_found",
  "message": "指定されたテンプレートが見つかりません",
  "details": { "resource": "template", "id": "tpl_xyz" }
}
```

### REST と WebSocket の責務分担

| 失敗の種類 | 発生箇所 | 通知経路 |
| --- | --- | --- |
| 入力バリデーション失敗 | REST ハンドラ（リクエスト受理前） | REST エラーレスポンス（`validation_error` / 400） |
| 参照リソース不在 | REST ハンドラ（DB 検索後） | REST エラーレスポンス（`not_found` / 404） |
| DB 接続不能等のサーバ内部例外 | REST ハンドラ | REST エラーレスポンス（`internal_error` / 500） |
| LLM 呼び出し失敗 / 出力パース失敗 / 個別エージェントタイムアウト | agent-core（202 受理後の非同期処理） | WebSocket `agent:status status="failed"`（reason: `llm_error` / `output_parse_error` / `timeout`） |
| 全 Investigation 失敗 / 統合失敗 / 実行全体タイムアウト | agent-core（202 受理後の非同期処理） | WebSocket `execution:failed`（reason: `all_investigations_failed` / `integration_failed` / `timeout`） |

詳細は [websocket-design.md §エラーイベント](./websocket-design.md) を参照。

## WebSocket

WebSocket の通信契約（メッセージ型・接続ライフサイクル・エラー表現・順序保証）は [websocket-design.md](./websocket-design.md) に分離した。

## 型共有

フロント・バックエンド間の型は `packages/shared` で一元管理する。

```bash
packages/shared/src/
├── api-types.ts         # REST API のリクエストレスポンス型
├── ws-types.ts          # WebSocket メッセージ型
└── domain-types.ts      # ドメインモデルの型Template, Execution 等）
```

- API の型定義を変更したら、フロント・バックエンド双方のコンパイルが通ることを確認する
- Hono のルート定義と `api-types.ts` の型を手動で同期する必要がある（tRPC のような自動推論はない）
- 本 doc（§エラーレスポンス 等）は実装前の暫定 SSoT。`api-types.ts` 実装後はコード側を SSoT とし、本 doc は参照リンクに切り替える（`ws-types.ts` と同一運用）
- `ws-types.ts` の SSoT 運用・コード側への移行方針は [websocket-design.md §型共有](./websocket-design.md) に集約する
