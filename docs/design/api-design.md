# API 設計規約

ADR-0009 で決定した REST API と WebSocket の設計方針。

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

**エラー時:**

```json
{
  "error": "Template not found",
  "details": { "templateId": "tpl_xyz" }
}
```

エラーの HTTP ステータスコード:

| コード | 用途 |
| --- | --- |
| 400 | バリデーションエラー |
| 404 | リソースが見つからない |
| 500 | サーバー内部エラー |

## WebSocket

### 接続

```text
ws://localhost:3000/ws?executionId=<id>
```

実行開始後、`executionId` を指定して接続する。

### メッセージ方向

- **サーバー → クライアント**: エージェントのステータス更新、出力ストリーミング、完了通知
- **クライアント → サーバー**: MVP では接続確立時のみ（将来的に中断・再開コマンドを追加可能）

### メッセージ方式

`type` フィールドで種別を識別する discriminated union。

```typescript
// packages/shared/src/ws-types.ts

type WsMessage =
  | { type: "agent:status"; agentId: string; status: "waiting" | "running" | "completed" }
  | { type: "agent:output"; agentId: string; chunk: string }
  | { type: "execution:completed"; resultId: string }
  | { type: "execution:error"; error: string }
```

### 接続ライフサイクル

1. クライアントが `/ws?executionId=xxx` に接続
2. サーバーが各エージェントの `agent:status` を送信（初期状態）
3. エージェント実行中は `agent:status`（状態遷移）と `agent:output`（ストリーミング）を随時送信
4. 全エージェント完了後、`execution:completed` を送信
5. エラー発生時は `execution:error` を送信
6. クライアントが接続を閉じる

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
