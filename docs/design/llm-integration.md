# LLM 呼び出し方針

Claude API を用いた LLM 呼び出しの設計方針。`packages/agent-core/src/llm-client.ts` の実装根拠となる。

## モデル選定

全エージェントで **Claude Sonnet 4.6**（`claude-sonnet-4-6`）を使用する。

| エージェント | model | 選定理由 |
| --- | --- | --- |
| Investigation Agent（×4） | `claude-sonnet-4-6` | 構造化 JSON 出力の安定性・応答速度・コストのバランス |
| Integration Agent（×1） | `claude-sonnet-4-6` | 同上。マトリクス生成は複雑だが Sonnet で十分な品質 |

### 不採用モデルと理由

| モデル | 不採用理由 |
| --- | --- |
| Opus 4.6 | 入出力単価が Sonnet の約 5 倍。学習プロジェクトではコスト対効果が合わない |
| Haiku 4.5 | 構造化出力（JSON スキーマ準拠）の安定性が Sonnet に劣る。MVP では出力品質を優先 |

> **将来の拡張**: v2 以降でエージェント種別ごとにモデルを切り替える場合、`TemplateDefinition` の agent 設定に `model` フィールドを追加して対応する。MVP ではハードコードで十分。

## LLM パラメータ

| エージェント | temperature | max_tokens | 根拠 |
| --- | --- | --- | --- |
| Investigation Agent | 0.3 | 2,048 | 事実整理タスク。低 temperature で一貫性を確保。観点あたり競合 3〜5 件の JSON 出力に 2,048 で十分 |
| Integration Agent | 0.2 | 4,096 | 矛盾抑制のためさらに低く設定。マトリクス Markdown + JSON の両方を出力するため 4,096 |

`top_p`, `top_k` はデフォルト値（未指定）とする。temperature で十分に制御できるため。

## ストリーミング方式

Anthropic SDK の streaming API を使い、トークン単位でクライアントに中継する。

### データフロー

```text
Claude API (SSE)
  → Anthropic SDK stream
    → agent-core: トークンチャンク受信
      → execution.service: WebSocket メッセージ送信
        → クライアント: リアルタイム表示
```

### 実装方針

1. **Anthropic SDK の `stream` オプション**を使用（`client.messages.stream()`）
2. `content_block_delta` イベントごとに `agent:output` WebSocket メッセージを送信
3. `message_stop` イベントで `agent:status = completed` を送信
4. **バッファリングは行わない** — トークン到着即転送でレイテンシを最小化
5. 完了後、全テキストを結合して JSON パース → DB 保存

### SDK 呼び出しの擬似コード

```typescript
const stream = anthropic.messages.stream({
  model: "claude-sonnet-4-6",
  max_tokens: 2048,
  temperature: 0.3,
  messages: [{ role: "user", content: prompt }],
  system: systemPrompt,
});

stream.on("text", (text) => {
  ws.send({ type: "agent:output", agentId, chunk: text });
});

const finalMessage = await stream.finalMessage();
// finalMessage.content → JSON パース → DB 保存
```

## エラーハンドリング・リトライ

### HTTP ステータス別の方針

| ステータス | 意味 | 対応 |
| --- | --- | --- |
| 429 | Rate limit | リトライ（指数バックオフ） |
| 500, 502, 503 | サーバーエラー | リトライ（指数バックオフ） |
| 408, ETIMEDOUT | タイムアウト | リトライ（指数バックオフ） |
| 400 | リクエスト不正 | リトライしない（バグ） |
| 401, 403 | 認証エラー | リトライしない（設定ミス） |

### リトライ設定

| 設定 | 値 | 根拠 |
| --- | --- | --- |
| 最大リトライ回数 | 3 回 | 学習プロジェクトで十分。過度なリトライはコスト増 |
| 初回待機時間 | 1 秒 | |
| バックオフ倍率 | 2（指数バックオフ） | 1s → 2s → 4s |
| 最大待機時間 | 30 秒 | 429 の `retry-after` ヘッダーがあればそちらを優先 |

### Anthropic SDK のリトライ機能

Anthropic SDK はデフォルトで 2 回のリトライを内蔵している。SDK のリトライ設定を活用し、独自リトライロジックの重複を避ける。

```typescript
const anthropic = new Anthropic({
  maxRetries: 3,
});
```

### エージェント単位の障害隔離

- Investigation Agent 1 つが失敗しても他の Investigation Agent は続行する
- Integration Agent は利用可能な Investigation 結果のみで統合を実行する
- 全 Investigation Agent が失敗した場合、Integration Agent は実行せず `execution:error` を送信する

## トークン見積もり

Hero UC（3 競合 × 4 観点）1 回の実行で想定されるトークン量。

### Investigation Agent（1 エージェントあたり）

| 項目 | トークン数（概算） | 内訳 |
| --- | --- | --- |
| system prompt | ~500 | 役割定義 + 出力フォーマット指示 |
| user message | ~3,000 | 競合リスト + 参考情報（最大 10,000 文字 ≒ 3,000 トークン） |
| **入力合計** | **~3,500** | |
| 出力（JSON） | ~800 | 競合 3 件 × 3〜5 ポイント |
| **入出力合計** | **~4,300** | |

### Integration Agent（1 エージェント）

| 項目 | トークン数（概算） | 内訳 |
| --- | --- | --- |
| system prompt | ~600 | 役割定義 + 出力フォーマット指示 |
| user message | ~3,800 | 競合リスト + Investigation 出力 4 件（各 ~800 トークン） |
| **入力合計** | **~4,400** | |
| 出力（Markdown + JSON） | ~2,000 | マトリクス + 所見 + 内部 JSON |
| **入出力合計** | **~6,400** | |

### 1 実行あたりの合計

| 項目 | トークン数 |
| --- | --- |
| Investigation ×4 | ~17,200（4,300 × 4） |
| Integration ×1 | ~6,400 |
| **合計** | **~23,600** |

### コスト概算（Claude Sonnet 4.6 の参考価格）

| 項目 | 単価 | 量 | 金額 |
| --- | --- | --- | --- |
| 入力トークン | $3 / 1M tokens | ~18,400 | ~$0.055 |
| 出力トークン | $15 / 1M tokens | ~5,200 | ~$0.078 |
| **1 実行あたり** | | | **~$0.13** |

> 学習プロジェクトとして 1 日 10 回実行しても ~$1.3/日。十分に許容範囲。

## プロンプトインジェクション対策

### MVP の方針

MVP ではユーザー入力は「競合企業名」と「参考情報テキスト」の 2 つのみ。以下の最低限の対策を行う。

1. **入力のバリデーション**（既存の JSON Schema バリデーションで対応）
   - 競合企業名: 1〜100 文字、1〜5 件
   - 参考情報: 最大 10,000 文字
2. **system prompt と user message の分離** — Anthropic SDK の `system` パラメータを使い、system prompt をユーザー入力と明確に分離する
3. **出力の型検証** — エージェント出力を JSON Schema でバリデーションし、想定外の構造を検出・拒否する

### MVP で行わないこと

- ユーザー入力のサニタイゼーション（特殊文字の除去等）— 参考情報にプロンプト風テキストが含まれる正当なケースがあるため、過度なサニタイゼーションは品質を損なう
- 出力内容のフィルタリング — MVP はシングルユーザー（開発者自身）のため、悪意ある入力のリスクは低い

> **v2 以降**: マルチユーザー対応時に入力サニタイゼーション、出力フィルタリング、レートリミットを追加する。

## プロバイダ依存の分離方針

### MVP の方針: 薄い wrapper

`packages/agent-core/src/llm-client.ts` に Anthropic SDK の薄い wrapper を置く。抽象インターフェースは切らない。

```typescript
// llm-client.ts — MVP の設計イメージ
import Anthropic from "@anthropic-ai/sdk";

export type LlmParams = {
  model: string;
  systemPrompt: string;
  userMessage: string;
  temperature: number;
  maxTokens: number;
};

export type StreamCallbacks = {
  onText: (chunk: string) => void;
};

export async function streamMessage(
  params: LlmParams,
  callbacks: StreamCallbacks,
): Promise<string> {
  const client = new Anthropic({ maxRetries: 3 });
  const stream = client.messages.stream({
    model: params.model,
    max_tokens: params.maxTokens,
    temperature: params.temperature,
    system: params.systemPrompt,
    messages: [{ role: "user", content: params.userMessage }],
  });

  stream.on("text", callbacks.onText);

  const message = await stream.finalMessage();
  // content[0] が text block であることを前提とする
  return message.content[0].type === "text" ? message.content[0].text : "";
}
```

### 不採用: 抽象インターフェース

MVP では Claude API のみを使用するため、プロバイダ抽象化（`LlmProvider` interface 等）はオーバーエンジニアリング。将来プロバイダを追加する時点で interface を抽出すれば十分。

### 依存の局所化

Anthropic SDK への依存は `packages/agent-core` に閉じ込める。`apps/api` や他のパッケージから直接 SDK を import しない。これにより、将来の差し替え時の変更範囲を `agent-core` 内に限定できる。
