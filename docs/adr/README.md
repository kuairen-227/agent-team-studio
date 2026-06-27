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
| [0009](./0009-architecture.md) | リポジトリ構成・アーキテクチャ方針 | accepted（一部 superseded by 0023） | 2026-04-17 |
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
| [0020](./0020-llm-sdk-selection.md) | LLM SDK の選定（`@anthropic-ai/sdk` 採用 ＋ 切替容易性方針） | accepted（一部 superseded by 0034） | 2026-05-02 |
| [0021](./0021-doc-cross-reference-policy.md) | ドキュメント間参照ポリシー（ハブ＆スポーク + 緩い水平参照） | accepted | 2026-05-02 |
| [0022](./0022-dependabot-operational-policy.md) | Dependabot 運用方針（SHA pin / workspace 集約 / patch auto-merge / major 個別 PR / cooldown） | accepted | 2026-05-03 |
| [0023](./0023-repository-layer-placement.md) | repo 層の物理的配置を packages/db に確定（ADR-0009 部分スーパーシード） | accepted | 2026-05-03 |
| [0024](./0024-playwright-mcp-for-ai-verification.md) | Playwright MCP を AI による UI 検証ツールとして採用 | accepted | 2026-05-04 |
| [0025](./0025-spa-routing-library.md) | SPA ルーティングライブラリの選定（React Router v7 採用） | superseded by [0027](./0027-tanstack-router.md) | 2026-05-04 |
| [0026](./0026-tanstack-query.md) | web 層のデータ取得ライブラリの選定（TanStack Query 採用） | accepted | 2026-05-06 |
| [0027](./0027-tanstack-router.md) | SPA ルーティングライブラリの再選定（TanStack Router 採用 / ADR-0025 supersede） | accepted | 2026-05-06 |
| [0028](./0028-split-env-infra-and-app.md) | env を DevContainer 変数とアプリ変数に分割し Vite proxy を可変化する | accepted | 2026-05-09 |
| [0029](./0029-free-llm-api-selection.md) | 無料 LLM API の選定（z.ai 有料化対応 → 再決定: Groq / ゲートウェイ経由） | accepted | 2026-05-10 |
| [0030](./0030-rename-manage-task-to-manage-issue.md) | `/manage-task` スキルを `/manage-issue` に改称し、Issue 構造化操作までを担う | accepted | 2026-05-23 |
| [0031](./0031-version-naming-convention.md) | プロダクトのバージョン命名規約（v1 = MVP に統一） | accepted | 2026-05-24 |
| [0032](./0032-llm-multi-vendor-strategy.md) | LLM マルチベンダー対応方式の選定（ADR-0020 一部再評価） | accepted（短期=方向1。恒久方式は方向2 へ確定） | 2026-06-02 |
| [0033](./0033-structured-logging-library.md) | 構造化ロギングライブラリの選定（Pino 採用） | accepted | 2026-06-03 |
| [0034](./0034-llm-client-ai-sdk.md) | LLM クライアントへの Vercel AI SDK Core 採用（恒久マルチベンダー方式の確定） | accepted | 2026-06-06 |
| [0035](./0035-error-tracking-selection.md) | エラートラッキング基盤の選定（Sentry free / SaaS 採用） | accepted | 2026-06-07 |
| [0036](./0036-web-layer-testing-trophy.md) | Web 層テスト方針に Testing Trophy を採用 | accepted | 2026-06-08 |
| [0037](./0037-ai-execution-sandbox-policy.md) | AI 実行のサンドボックス方針（Bash サンドボックス見送り・DevContainer egress allowlist 採用） | accepted（firewall 実装方式は ADR-0041 で一部 superseded） | 2026-06-08 |
| [0038](./0038-autonomous-agent-loop-adoption.md) | 自律エージェントループ（Planner / Generator / Evaluator）の採否と段階導入方針 | accepted | 2026-06-08 |
| [0039](./0039-secret-read-guard.md) | AI エージェントによるシークレット読取ガードの強化とシークレット管理方式（ADR-0037 拡張） | accepted（論点 2 / Decision 3 は ADR-0040 で再評価） | 2026-06-09 |
| [0040](./0040-defer-secret-at-rest-encryption.md) | シークレット at-rest 暗号化の見送りと残存リスクの運用統制による受容（ADR-0039 一部再評価） | accepted | 2026-06-14 |
| [0041](./0041-egress-firewall-nftables-ipv6.md) | egress firewall の nftables 移行と IPv6 egress 方針（ADR-0037 一部再評価） | accepted | 2026-06-16 |
| [0042](./0042-ci-dependency-audit-with-bun-audit.md) | CI への依存スキャン（bun audit）導入と閾値 critical の選定 | accepted | 2026-06-17 |
| [0043](./0043-autonomous-loop-orchestration-mechanism.md) | 自律ループのオーケストレーション手段の確定（自前 = Claude Code サブエージェント + ファイルハンドオフ。ADR-0038 論点 3 の確定） | accepted | 2026-06-26 |
| [0044](./0044-v2-scope-definition.md) | v2.0 機能拡張のスコープ定義（基準3 決着 + UC#2 / フェーズ制 + Go/No-Go） | accepted（v2.1 割当は 0045 で一部再評価） | 2026-06-26 |
| [0045](./0045-minor-version-milestone-generalization.md) | vN.x マイルストーンの一般化と v2.1 のデザイン質感改善への割当（ADR-0031 拡張） | proposed | 2026-06-27 |

## 新しい ADR の作成方法

1. [template.md](./template.md) をコピーする
2. 連番でファイル名を付ける（例: `0005-choose-database.md`）
3. Status に作成日・関連 ADR/Issue を記入する
4. Context → Considered Alternatives → Decision → Consequences の順に記入する
5. Consequences は決定の結果の中立記述に徹める（緩和策は Decision または後続 Issue で扱う。詳細は [ADR-0001](./0001-record-architecture-decisions.md) 参照）
6. この README の一覧表に追加する

**注**: ADR は複数を並行して検討・作成してよい。連番はファイル作成順であり、検討や承認の順序を意味しない。
