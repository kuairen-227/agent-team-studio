# 0029. 無料 LLM API の選定（z.ai 有料化対応）

## Status

accepted

- 作成日: 2026-05-10
- 関連: ADR-0020（Anthropic SDK 選定）, Issue #156

## Context

z.ai（GLM）が 2026 年 2 月に有料化したため、開発継続に向けて無料で利用できる LLM API を選定する必要が生じた。

現在は Anthropic API キー（従量課金）で暫定運用中。学習プロジェクト（ADR-0002）のため、コスト削減と自由度のバランスを考慮した選定が必要。

ADR-0020 で確定した Anthropic SDK の使用方針により、以下のいずれかを選定すれば**既存コード（`packages/agent-core/src/llm-client.ts`）の変更は不要**である：

- Anthropic 互換 API エンドポイント（`/v1/messages`）を提供するサービスに切り替え
- `LLM_BASE_URL` 環境変数で接続先を変更するのみ

## Considered Alternatives

### 無料 LLM API 候補

| # | サービス | Anthropic 互換 | コード変更 | レート制限 | デメリット | 判定 |
| - | --- | --- | --- | --- | --- | --- |
| A | OpenRouter（無料モデル） | ✅ Yes | 不要 | 20 req/min, 200 req/day | JSON 安定性は Sonnet 以下 | **採用** — 推奨 |
| B | Ollama（ローカル） | ✅ Yes | 不要 | なし | ローカルスペース必要（40GB+ 推奨） | **採用** — 代替案 |
| C | Groq（OpenAI 互換） | ❌ No | 必要 | 30 req/min | コード書き換え必要、Interface 抽出 ADR も要 | 却下 |
| D | Google Gemini（独自 API） | ❌ No | 必要 | あり | コード書き換え必要 | 却下 |
| E | 他の Anthropic 互換サービス | – | 調査時点で見当たらず | – | z.ai 廃止後、継続的なサービスが不明 | 却下 |

### 選定プロセス

1. **Anthropic 互換の有無** — ADR-0020 で「Anthropic SDK の切替点は `llm-client.ts` に集約」と確定したため、Anthropic 互換 API が利用可能なサービスを優先
2. **コード変更の最小化** — 既存の `client.messages.stream()` が動作するサービスを選択
3. **信頼性・継続性** — サービスの提供元・ステータスが明確でテスト済みのものを選択

## Decision

### 1. OpenRouter（推奨）

OpenRouter の無料モデルを採用する。

**設定方法**: `LLM_BASE_URL=https://openrouter.ai/api`

**利用可能な無料モデル**（2026 年 5 月時点）:
- Llama 3.3 70B — 高品質な汎用モデル
- DeepSeek R1 — 推論タスク向け
- Qwen 3 Coder 480B — コード生成向け
- その他 26+ モデル

**レート制限**:
- 20 requests/minute
- 200 requests/day
- 対開発・検証用途としては十分

**推奨理由**:
- Anthropic 互換エンドポイント（`/v1/messages`）を提供
- コード変更不要
- クラウドサービス（ローカルスペック不要）
- モデル選択肢が豊富
- 将来的に有料モデル（Claude など）への切り替えも容易

**制約**:
- JSON 出力の安定性が Claude Sonnet 4.6 より低い可能性（要テスト）
- 競合調査用途では出力品質が重要なため、テストで検証必要
- 無料モデルのため、精度・応答速度が落ちる可能性

### 2. Ollama（代替案）

ローカル実行環境として Ollama を代替案とする。

**設定方法**: `ANTHROPIC_BASE_URL=http://localhost:11434`

**利用可能な無料モデル**（ローカル実行）:
- Llama 3.3 70B
- Llama 3.1 405B（GPU メモリ大）
- Mistral 7B（軽量）
- その他オープンソースモデル

**レート制限**: なし（完全ローカル）

**推奨シーン**:
- プライベート環境（データを社内に閉じたい）
- 無制限トライアル（API 呼び出し制限なし）
- GPU を備えたローカル環境がある場合

**制約**:
- Llama 3.3 70B は ~40GB メモリ必要
- モデルのダウンロード・管理がローカル
- M1/M2 Mac や RTX 4090 等のハイスペック環境推奨

## Consequences

### ポジティブ

- **既存コード変更なし** — `llm-client.ts` の内部実装（`LLM_BASE_URL` 参照）のみで対応可能
- **開発コスト削減** — z.ai 有料化による開発中断を回避
- **柔軟性** — OpenRouter → Ollama、または無料 → 有料モデルへの切り替えが環境変数で可能
- **学習価値** — Anthropic 互換 API の複数実装（OpenRouter / Ollama）で API 標準化の重要性を体験

### ネガティブ / リスク

- **出力品質の低下** — Sonnet 4.6 → Llama 3.3 70B では JSON 構造化出力の安定性が低下する可能性
  - **緩和策**: テストスイート（`bun run test`）を拡充し、出力品質を監視する
- **デフォルト推奨の決定が必要** — OpenRouter vs Ollama の本運用選択は別途 Issue で決定する
  - **方針**: 初期デフォルトは OpenRouter（クラウド、スケーラブル）とし、環境変数で Ollama に切り替え可能にする
- **OpenRouter のレート制限** — 無料ティア 20 req/min は並列実行（Investigation Agent ×4）では余裕が必要
  - **評価**: MVP 範囲では十分（実際の実行パターンで都度確認）

### 中立

- ADR-0020 に「2 つ目の provider が現実化した場合は Interface 抽出 ADR を切る義務」と記述があったが、本決定では Anthropic 互換エンドポイント利用のため Interface 抽出は不要
- Groq / Gemini への切り替えが今後必要になった場合は、その時点で本 ADR を superseded する新 ADR を切る

## 実装計画

- 新規 ガイド（`docs/guides/free-llm-setup.md`）で OpenRouter / Ollama の選択フロー・セットアップ手順を記載
- `apps/api/.env.example` を更新し、両方の設定例を併記
- テスト実行で動作確認
- 本 ADR の Decision §2 より、デフォルトは OpenRouter に設定
