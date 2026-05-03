# Architecture Decision Records (ADR)

アーキテクチャに関する重要な意思決定を記録するディレクトリです。

## ADR とは

ADR は、アーキテクチャ上の重要な決定とその背景・理由・結果を記録する軽量なドキュメントです。Michael Nygard のフォーマットに基づいています。

## ADR 一覧

| # | タイトル | ステータス | 日付 |
| --- | --------- | ----------- | ------ |
| [0001](./0001-record-architecture-decisions.md) | ADR を用いてアーキテクチャの意思決定を記録する | accepted | 2026-04-17 |
| [0002](./0002-project-scenario.md) | プロジェクトの前提・状況設定 | accepted | 2026-04-17 |
| [0003](./0003-product-concept.md) | プロダクトコンセプト | accepted | 2026-04-17 |
| [0004](./0004-target-users.md) | ターゲットユーザー | accepted | 2026-04-17 |
| [0005](./0005-mvp-scope.md) | MVP スコープ | accepted | 2026-04-17 |
| [0006](./0006-lightweight-agile-process.md) | 開発プロセスの軽量アジャイル化 | accepted | 2026-04-17 |
| [0007](./0007-ai-driven-dev-architecture.md) | AI駆動開発アーキテクチャ | accepted | 2026-04-17 |
| [0008](./0008-tech-stack.md) | 技術スタック | accepted | 2026-04-17 |
| [0009](./0009-architecture.md) | リポジトリ構成・アーキテクチャ方針 | accepted | 2026-04-17 |
| [0010](./0010-development-workflow.md) | 開発フローの選定 | accepted | 2026-04-19 |
| [0011](./0011-role-based-agent-architecture.md) | ロールベースエージェントアーキテクチャ | accepted | 2026-04-20 |
| [0012](./0012-git-worktree-parallel-sessions.md) | Git Worktree による並行セッション運用の採用 | accepted | 2026-04-21 |
| [0013](./0013-doc-placement-policy.md) | ドキュメント配置ポリシー | accepted | 2026-04-21 |
| [0014](./0014-mvp-data-model-design.md) | MVP データモデル設計方針 | accepted | 2026-04-22 |
| [0015](./0015-add-designer-agent.md) | デザイナーエージェントの追加 | accepted | 2026-04-26 |
| [0016](./0016-devcontainer-integration.md) | DevContainer の統合構成（compose + features + 認証共有 volume） | accepted（一部 superseded by 0018） | 2026-04-29 |
| [0017](./0017-design-development-principles.md) | 設計・開発原則ドキュメントの新設 | accepted | 2026-05-01 |
| [0018](./0018-relocate-compose-and-consolidate-env.md) | docker-compose / Dockerfile をリポジトリルートに配置し、env を部品方式に統合する | accepted | 2026-05-01 |
| [0019](./0019-split-principles-by-topic.md) | 設計・開発原則ドキュメントを主題別に分割する（初出: テスト原則） | accepted | 2026-05-02 |
| [0020](./0020-llm-sdk-selection.md) | LLM SDK の選定（`@anthropic-ai/sdk` 採用 ＋ 切替容易性方針） | accepted | 2026-05-02 |
| [0021](./0021-doc-cross-reference-policy.md) | ドキュメント間参照ポリシー（ハブ＆スポーク + 緩い水平参照） | accepted | 2026-05-02 |

## 新しい ADR の作成方法

1. [template.md](./template.md) をコピーする
2. 連番でファイル名を付ける（例: `0005-choose-database.md`）
3. Status に作成日・関連 ADR/Issue を記入する
4. Context → Considered Alternatives → Decision → Consequences の順に記入する
5. Consequences は決定の結果の中立記述に徹める（緩和策は Decision または後続 Issue で扱う。詳細は [ADR-0001](./0001-record-architecture-decisions.md) 参照）
6. この README の一覧表に追加する

**注**: ADR は複数を並行して検討・作成してよい。連番はファイル作成順であり、検討や承認の順序を意味しない。
