# 外部サービス一覧

開発者がアカウント取得・API キー設定が必要な外部サービスの一覧。新メンバーのオンボーディング時に参照する。

## LLM API

| サービス | 用途 | コンソール | 必要度 |
| --- | --- | --- | --- |
| **Anthropic** | メイン LLM（Claude Sonnet 4.6）。品質・安定性が最高 | [console.anthropic.com](https://console.anthropic.com) | いずれか 1 つ必須 |
| **Groq** | 無料 LLM（Llama 3.3 70B）。カード不要・高速 | [console.groq.com](https://console.groq.com) | いずれか 1 つ必須 |
| OpenRouter | 条件付き代替（BYOK でレート枠拡張）。`:free` は入金実質必須 | [openrouter.ai](https://openrouter.ai) | 任意 |
| Ollama | ローカル LLM。**GPU 推論が実質前提**（CPU 不可） | [ollama.com](https://ollama.com) | 任意 |

推奨の組み合わせ:

- **品質優先**: Anthropic（`anthropic:claude-sonnet-4-6`）
- **無料運用**: Groq（`groq:llama-3.3-70b-versatile`）

詳細は [free-llm-setup.md](./free-llm-setup.md) を参照。

## エラートラッキング

| サービス | 用途 | コンソール | 必要度 |
| --- | --- | --- | --- |
| **Sentry** | 未キャッチ例外・ブラウザエラーの集約・通知（free tier: 5K events/月） | [sentry.io](https://sentry.io) | 任意（DSN 未設定時は送信無効） |

DSN は `apps/api/.env`（サーバー側）と `apps/web/.env`（クライアント側・公開前提）にそれぞれ設定する。

> **実装状況**: ADR-0035 で採用決定済みだが、SDK 組み込みは未実装（Issue #237）。現時点では設定不要。

## Claude Code（AI 開発環境）

| サービス | 用途 | コンソール | 必要度 |
| --- | --- | --- | --- |
| **Claude Code** | AI ペアプログラミング CLI。DevContainer 内で `claude login` で認証 | [claude.ai/code](https://claude.ai/code) | 開発者必須 |

DevContainer 初回起動後に `claude login` を実行する（[devcontainer.md](./devcontainer.md#初回セットアップ)）。認証トークンは `agent-team-studio-claude-home` named volume で永続化・共有される。

## 関連

- [free-llm-setup.md](./free-llm-setup.md) — LLM プロバイダーの切り替え手順
- [env.md](./env.md) — 環境変数・シークレット管理ルール
- [devcontainer.md](./devcontainer.md) — DevContainer 構成・初回セットアップ
