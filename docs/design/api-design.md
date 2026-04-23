# API 設計規約

ADR-0009 で決定した REST API の設計方針。WebSocket メッセージ契約は [ws-messages.md](./ws-messages.md) を参照。

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

WebSocket の通信契約（メッセージ型・接続ライフサイクル・エラー表現・順序保証）は [ws-messages.md](./ws-messages.md) に分離した。

## 型共有

フロント・バックエンド間の型は `packages/shared` で一元管理する。

```bash
packages/shared/src/
├── api-types.ts         # REST API のリクエストレスポンス型
├── ws-types.ts          # WebSocket メッセージ型（詳細は ws-messages.md）
└── domain-types.ts      # ドメインモデルの型Template, Execution 等）
```

- API の型定義を変更したら、フロント・バックエンド双方のコンパイルが通ることを確認する
- Hono のルート定義と `api-types.ts` の型を手動で同期する必要がある（tRPC のような自動推論はない）
- `ws-types.ts` の内容は [ws-messages.md §メッセージ型](./ws-messages.md) と厳密に一致させる（実装後はコード側を SSoT とし、本 doc は参照リンクに切り替える）
