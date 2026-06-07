# LLM 呼び出し方針

Claude API を用いた LLM 呼び出しの設計方針。`packages/agent-core/src/llm-client.ts` の実装根拠となる。

**呼び出し構造**: `engine.ts`（チーム実行制御）→ `agent.ts`（個別エージェント実行）→ `llm-client.ts`（LLM API 呼び出し）。`llm-client.ts` を直接呼ぶのは `agent.ts` のみ。

## モデル選定

全エージェントで **Claude Sonnet 4.6**（`anthropic:claude-sonnet-4-6`）を使用する。

model は `provider:model` 形式で指定する（[ADR-0034](../adr/0034-llm-client-ai-sdk.md)）。`llm-client.ts` は接頭辞の provider（`anthropic` / `groq`）で AI SDK の provider レジストリを引き、対応する API キー env（`ANTHROPIC_API_KEY` / `GROQ_API_KEY`）を参照する。

| エージェント | model | 選定理由 |
| --- | --- | --- |
| Investigation Agent（×4） | `anthropic:claude-sonnet-4-6` | 構造化 JSON 出力の安定性・応答速度・コストのバランス |
| Integration Agent（×1） | `anthropic:claude-sonnet-4-6` | 同上。マトリクス生成は複雑だが Sonnet で十分な品質 |

### 不採用モデルと理由

| モデル | 不採用理由 |
| --- | --- |
| Opus 4.6 | 入出力単価が Sonnet の約 5 倍。学習プロジェクトではコスト対効果が合わない |
| Haiku 4.5 | 構造化出力（JSON スキーマ準拠）の安定性が Sonnet に劣る。MVP では出力品質を優先 |

> **将来の拡張**: v2 以降でエージェント種別ごとにモデルを切り替える場合、`TemplateDefinition` の agent 設定に `model` フィールドを追加して対応する。MVP ではハードコードで十分。

## LLM パラメータ

| エージェント | temperature | max_tokens | 根拠 |
| --- | --- | --- | --- |
| Investigation Agent | 0.3 | 1,500 | 事実整理タスク。低 temperature で一貫性を確保。観点あたり競合 3〜5 件の JSON 出力に 1,500 で十分 |
| Integration Agent | 0.2 | 8,000 | 矛盾抑制のためさらに低く設定。マトリクス Markdown + JSON の両方を出力するため 8,000（3 社×4 観点で 3,000 では出力が途中切れになることをドッグフーディング #205 で確認） |

`top_p`, `top_k` はデフォルト値（未指定）とする。temperature で十分に制御できるため。

> **プロバイダー切替時の注意**: `max_tokens=8000` はモデル側の Max Output Tokens 内に収まる必要がある。Anthropic 本家・OpenRouter 主要無料モデル（DeepSeek R1 / Llama 3.3 70B 等）は満たすが、低トークン制限のプロバイダー（例: Cerebras 無料枠は context cap 8,192 のため入出力合計が窮屈で 8,000 tokens の出力を確保できない）では採用できない。

## ストリーミング方式

AI SDK Core（`streamText`）の streaming API を使い、トークン単位でクライアントに中継する（[ADR-0034](../adr/0034-llm-client-ai-sdk.md)）。

### データフロー

```text
LLM API (SSE)
  → AI SDK Core streamText().textStream
    → agent-core (agent.ts): トークンチャンク受信、コールバック呼び出し
      → apps/api (execution.service): WebSocket メッセージ送信
        → クライアント: リアルタイム表示
```

**依存方向の維持**: `agent-core` は `apps/api` に依存しない（ADR-0009）。`apps/api` 側が `agent-core` にコールバックを注入し、`agent-core` はそのコールバックを呼び出すことで WebSocket 送信をトリガーする。依存方向は `apps/api → agent-core` の一方向を保つ。

### 実装方針

1. **AI SDK Core の `streamText().textStream`**（`AsyncIterable<string>`）を使用。delta 抽出・SSE パースは AI SDK が内部で行う
2. テキストチャンクごとにコールバック経由で `agent:output` を通知
3. ストリーム終端で `agent:status = completed` を通知
4. **バッファリングは行わない** — トークン到着即転送でレイテンシを最小化
5. 完了後、全テキストを結合して JSON パース → DB 保存
6. **ストリーミング中断時** — 部分出力済みでエラーが発生した場合、当該エージェントを失敗扱いとし `agent:status = failed` を通知する。部分出力は保存しない

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

### リトライの実装方針

AI SDK Core 内蔵のリトライ機能に委任する。独自リトライロジックは実装しない（二重リトライによる意図しない試行回数の増加を防ぐため）。`streamText` の `maxRetries` を 3 に設定し、上記のリトライ設定に相当する挙動を SDK 側で実現する。

### エージェント単位の障害隔離

- Investigation Agent 1 つが失敗しても他の Investigation Agent は続行する
- Integration Agent は利用可能な Investigation 結果のみで統合を実行する
- 全 Investigation Agent が失敗した場合、Integration Agent は実行せず `execution:failed` を送信する

## トークン見積もり

Hero UC（3 競合 × 4 観点）1 回の実行で想定されるトークン量。

### Investigation Agent（1 エージェントあたり）

| 項目 | トークン数（概算） | 内訳 |
| --- | --- | --- |
| system prompt | ~500 | 役割定義 + 出力フォーマット指示 |
| user message | ~3,000 | 競合リスト + 参考情報（最大 10,000 文字 ≒ 3,000 トークン） |
| **入力合計** | **~3,500** | |
| 出力（JSON） | ~800 | 競合 3 件 × 3〜5 ポイント（`max_tokens: 1500` で上限制御） |
| **入出力合計** | **~4,300** | |

### Integration Agent（1 エージェント）

| 項目 | トークン数（概算） | 内訳 |
| --- | --- | --- |
| system prompt | ~600 | 役割定義 + 出力フォーマット指示 |
| user message | ~3,800 | 競合リスト + Investigation 出力 4 件（各 ~800 トークン。`max_tokens` で上限制御されるため大幅超過はない） |
| **入力合計** | **~4,400** | |
| 出力（Markdown + JSON） | ~3,500 | マトリクス + 所見 + 内部 JSON（3 社×4 観点で 3,000 超過を #205 ドッグフーディングで確認。3,500 は保守的上方推定） |
| **入出力合計** | **~7,900** | |

### 1 実行あたりの合計

| 項目 | トークン数 |
| --- | --- |
| Investigation ×4 | ~17,200（4,300 × 4） |
| Integration ×1 | ~7,900 |
| **合計** | **~25,100** |

### コスト概算（Claude Sonnet 4.6 の参考価格）

| 項目 | 単価 | 量 | 金額 |
| --- | --- | --- | --- |
| 入力トークン | $3 / 1M tokens | ~18,400 | ~$0.055 |
| 出力トークン | $15 / 1M tokens | ~6,700 | ~$0.100 |
| **1 実行あたり** | | | **~$0.16** |

> 学習プロジェクトとして 1 日 10 回実行しても ~$1.3/日。十分に許容範囲。

## プロンプトインジェクション対策

### MVP の方針

MVP ではユーザー入力は「競合企業名」と「参考情報テキスト」の 2 つのみ。以下の最低限の対策を行う。

1. **入力のバリデーション**（既存の JSON Schema バリデーションで対応）
   - 競合企業名: 1〜100 文字、1〜5 件
   - 参考情報: 最大 10,000 文字
2. **system prompt と user message の分離** — AI SDK Core の `system` パラメータを使い、system prompt をユーザー入力と明確に分離する
3. **出力の型検証** — エージェント出力を JSON Schema でバリデーションし、想定外の構造を検出・拒否する

### MVP で行わないこと

- ユーザー入力のサニタイゼーション（特殊文字の除去等）— 参考情報にプロンプト風テキストが含まれる正当なケースがあるため、過度なサニタイゼーションは品質を損なう
- 出力内容のフィルタリング — MVP はシングルユーザー（開発者自身）のため、悪意ある入力のリスクは低い

> **v2 以降**: マルチユーザー対応時に入力サニタイゼーション、出力フィルタリング、レートリミットを追加する。

## プロバイダ依存の分離方針

採用 SDK は **Vercel AI SDK Core**（`ai` + provider パッケージ）（[ADR-0034](../adr/0034-llm-client-ai-sdk.md)。ADR-0020 の `@anthropic-ai/sdk` 採用を supersede）。`packages/agent-core/src/llm-client.ts` に provider レジストリと薄い wrapper を置き、以下のルールで切替点を集約する。

- **境界の集約** — AI SDK（`ai` / `@ai-sdk/*`）の `import` は `llm-client.ts` のみで行う。`apps/api` や `agent-core` 内の他ファイルからは直接 import しない
- **公開シグネチャのドメイン型化** — `llm-client.ts` の公開関数（`streamAgentMessage(input): AsyncIterable<string>`）は引数・戻り値・例外を `agent-core` のドメイン型で定義する。AI SDK の型（`APICallError` 等）を境界の外へ漏らさない。API 例外は `LlmError('llm_error')` に写像する
- **provider 抽象はライブラリに委譲** — 自前 `LlmProvider` interface は切らず、AI SDK の `createProviderRegistry` を使う（ADR-0020 方針4 の充足）。provider は model 文字列の `provider:model` 接頭辞（`anthropic` / `groq`）で解決し、各 provider は標準 env（`ANTHROPIC_API_KEY` / `GROQ_API_KEY`、任意で `*_BASE_URL`）を参照する。provider 追加はレジストリへの 1 行追加で済む
