# 0029. 無料 LLM API の選定（z.ai 有料化対応）

## Status

accepted

- 作成日: 2026-05-10
- 関連: ADR-0020（Anthropic SDK 選定）, Issue #156

## Context

z.ai（GLM）が 2026 年 2 月に有料化したため、開発継続に向けて無料で利用できる LLM API を選定する必要が生じた。

現在は Anthropic API キー（従量課金）で暫定運用中。学習プロジェクト（ADR-0002）のため、コスト削減と自由度のバランスを考慮した選定が必要。加えて、複数の LLM API プロバイダの実装を通じて、API 標準化の重要性（Anthropic 互換エンドポイント）を体験することも学習効果として狙う。

ADR-0020 で確定した Anthropic SDK の使用方針により、以下のいずれかを選定すれば**既存コード（`packages/agent-core/src/llm-client.ts`）の変更は不要**である：

- Anthropic 互換 API エンドポイント（`/v1/messages`）を提供するサービスに切り替え
- `LLM_BASE_URL` 環境変数で接続先を変更するのみ

## Considered Alternatives

### 無料 LLM API 候補

| # | サービス | Anthropic 互換 | コード変更 | レート制限 | デメリット | 判定 |
| - | --- | --- | --- | --- | --- | --- |
| A | OpenRouter（無料モデル） | ✅ Yes | 不要 | 20 req/min, 50 req/day | JSON 安定性は Sonnet 以下 | **採用** — 無料代替案（クラウド） |
| B | Ollama（ローカル） | ✅ Yes | 不要 | なし | ローカルスペース必要（40GB+ 推奨） | **採用** — 無料代替案（ローカル） |
| C | Groq（OpenAI 互換） | ❌ No | 必要 | 30 req/min | コード書き換え必要、Interface 抽出 ADR も要 | 却下 |
| D | Google Gemini（独自 API） | ❌ No | 必要 | あり | コード書き換え必要 | 却下 |
| E | 他の Anthropic 互換サービス | – | 見当たらず | – | 調査時点で選択肢がなく、z.ai 廃止後のサービス継続性も不透明 | 却下 |

**出典**:

- OpenRouter Anthropic 互換: [Integration with Claude Code | OpenRouter](https://openrouter.ai/docs/guides/coding-agents/claude-code-integration)
- Ollama Anthropic 互換: [Anthropic compatibility - Ollama](https://docs.ollama.com/api/anthropic-compatibility)（v0.14.0 以降）

### 選定プロセス

1. **Anthropic 互換の有無** — ADR-0020 で「Anthropic SDK の切替点は `llm-client.ts` に集約」と確定したため、Anthropic 互換 API が利用可能なサービスを優先
2. **コード変更の最小化** — 既存の `client.messages.stream()` が動作するサービスを選択
3. **信頼性・継続性** — サービスの提供元・ステータスが明確でテスト済みのものを選択

## Decision

### 本方針

z.ai 有料化への対応として、Anthropic SDK の `LLM_BASE_URL` 環境変数を活用し、複数の LLM API プロバイダに簡単に切り替え可能な体系を採用する。

この方針により:

- **コード変更なし** — `packages/agent-core/src/llm-client.ts` は既に対応済み
- **柔軟性** — 環境変数のみで Anthropic → OpenRouter → Ollama に切り替え可能

### 実装パターン A: Anthropic 本家（推奨デフォルト）

Anthropic API を推奨デフォルトとする（既に暫定運用中のため、継続）。

**設定方法**: 環境変数 `LLM_BASE_URL` 未設定時は自動的に `api.anthropic.com` を使用

```bash
LLM_API_KEY=YOUR_ANTHROPIC_API_KEY
# LLM_BASE_URL は省略（デフォルトで api.anthropic.com を使用）
```

**特徴**:

- 最高品質（Claude Sonnet 4.6）— 競合調査用途での出力品質を優先
- JSON 構造化出力の安定性が確実
- 学習プロジェクト（ADR-0002）のため、プロダクション品質の体験が重要
- 既に暫定運用中で、設定・テストが確立している

**制約**:

- 従量課金（課金リスク）

### 実装パターン B: OpenRouter（無料代替案）

無料で利用したい場合の代替案として OpenRouter の無料モデルを用意する。

**設定方法**: `LLM_BASE_URL=https://openrouter.ai/api`

**利用可能な無料モデル**（2026 年 5 月時点）:

- `meta-llama/llama-3.3-70b-instruct:free` — 高品質な汎用モデル
- `deepseek/deepseek-r1:free` — 推論タスク向け
- `qwen/qwen3-coder:free` — コード生成向け
- その他 26+ モデル

**特徴**:

- 完全無料（複数モデル選択可能）
- クラウド実行（スケーラブル）
- セットアップが簡単

**制約**:

- レート制限: 20 requests/minute, 50 requests/day（クレジット未購入時）
- JSON 出力の安定性が Sonnet 4.6 より低い可能性（要テスト）
- 無料モデルのため、精度・応答速度が落ちる可能性

### 実装パターン C: Ollama（ローカル無料代替案）

ローカル実行環境として Ollama を代替案とする。

**設定方法**: `LLM_BASE_URL=http://localhost:11434`

**利用可能な無料モデル**（ローカル実行）:

- Llama 3.3 70B（推奨：40GB メモリで運用可能）
- Mistral 7B（軽量：16GB メモリで運用可能）
- Llama 3.1 405B（1.5TB メモリ・8x A100/H100 必須、エンタープライズ向け）
- その他オープンソースモデル

**特徴**:

- 完全無料・無制限
- プライベート環境（データを社内に閉じられる）
- レート制限なし

**制約**:

- ローカル実行のためメモリ要求が大きい
  - Llama 3.3 70B: ~40GB（MacBook Pro M2 Max、RTX 4080/4090 推奨）
  - Llama 3.1 405B: ~1.5TB（8x A100/H100 必須、エンタープライズ向け）
- モデルのダウンロード・管理がローカル
- ダウンロード時間が長い（モデルサイズ + 回線速度に依存、数時間要する場合もあり）

## Consequences

### ポジティブ

- **既存コード変更なし** — `llm-client.ts` の内部実装（`LLM_BASE_URL` 参照）のみで対応可能
- **開発コスト削減** — z.ai 有料化による開発中断を回避
- **柔軟性** — OpenRouter → Ollama、または無料 → 有料モデルへの切り替えが環境変数で可能
- **動作確認済み** — OpenRouter・Ollama の Anthropic 互換エンドポイント（`/v1/messages`）を公式ドキュメントで確認済み

### ネガティブ / リスク

- **出力品質の低下** — OpenRouter / Ollama の無料モデル使用時、JSON 構造化出力の安定性が Sonnet 4.6 より低下する可能性
  - **緩和策**: テストスイート（`bun run test`）を拡充し、出力品質を監視する
- **OpenRouter のレート制限** — 無料ティア 20 req/min, 50 req/day
  - **評価**: Investigation Agent ×4 の並列実行（単一実行 ~5 req 消費）では 50 req/day は不十分な可能性。Ollama への切り替えまたは OpenRouter へのクレジット投入を推奨
- **Ollama 使用時の `LLM_API_KEY` 要件** — ADR-0020 Design で `llm-client.ts` はモジュールロード時に `LLM_API_KEY` の存在チェックを行う。Ollama はキー認証を要求しないが、SDK の検証を回避するため任意のダミー値（`LLM_API_KEY=ollama` など）が必要
  - **緩和策**: ガイド・.env.example に明示し、起動エラーを防止
- **Anthropic 本家への継続依存** — 従量課金によるコスト増加のリスク
  - **緩和策**: 本 Decision により 2 つの無料代替案（OpenRouter / Ollama）を用意。将来 OpenRouter / Ollama への完全移行が必要になった場合は本 ADR を supersede する新 ADR を切る

### 中立

- **ADR-0020 の Interface 抽出義務について**: ADR-0020 に「2 つ目の provider が現実化した場合は Interface 抽出 ADR を切る義務」と記述があるが、本決定では OpenRouter と Ollama が両者とも Anthropic 互換エンドポイント（`/v1/messages`）を実装するため、`llm-client.ts` の公開型（Domain Types）は変わらず、既存の Anthropic 互換抽象化で十分。したがって Interface 抽出 ADR は不要
- Groq / Gemini など Anthropic 互換エンドポイントを提供しないサービスへの切り替えが今後必要になった場合は、その時点で本 ADR を supersede する新 ADR を切る

## デフォルト設定

**本番デフォルト**: Anthropic 本家（既存の暫定運用を継続）。環境変数 `LLM_BASE_URL` で OpenRouter / Ollama に切り替え可能。

将来、OpenRouter / Ollama への完全移行が必要になった場合は、その時点で本 ADR を supersede する新 ADR を切る。
