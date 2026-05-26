# AI 駆動開発ハーネス

本リポジトリが Claude Code と協働するために整備した開発環境の全体構成。意思決定の背景は [ADR-0007](../adr/0007-ai-driven-dev-architecture.md) と [ADR-0011](../adr/0011-role-based-agent-architecture.md) を参照。

## 全体構成

```
.claude/
├── settings.json        # hooks / permissions / status-line / MCP
├── hooks/               # hook スクリプト
│   └── post-edit-lint.sh
├── agents/              # 専門知識エージェント定義
│   ├── po.md
│   ├── pm.md
│   ├── architect.md
│   ├── qa.md
│   └── designer.md
├── rules/               # ファイルパスマッチで自動ロードされる制約
│   ├── typescript.md    # *.ts / *.tsx
│   ├── design-docs.md   # docs/design/**
│   └── product-docs.md  # docs/product/**
└── skills/              # スラッシュコマンド（定型作業の自動化）
    ├── process-issue/
    ├── manage-issue/
    ├── review/
    ├── create-adr/
    ├── create-issue/
    ├── create-pr/
    ├── implement-feature/
    ├── write-design-doc/
    ├── write-product-doc/
    ├── resolve-review/
    ├── cleanup-merged-branch/
    └── judge-dev-mode/
```

## レイヤー別の役割

### memory 層

Claude Code が参照するコンテキストの仕組み。

| コンポーネント | ロード条件 | 内容 |
| --- | --- | --- |
| `CLAUDE.md` | 常時（セッション起動時） | プロジェクト全体横断の起動時ガイダンス。文体・コーディング規約・主要コマンド・プロジェクト管理規約 |
| `docs/principles/README.md` | CLAUDE.md から参照（常時参照可能） | 設計・開発原則の SSoT。CLAUDE.md が要点を持ち、principles が詳細・全体像を担う |
| `.claude/rules/*.md` | frontmatter の `paths:` に一致するファイルを編集したとき | ドメイン固有の追加制約。CLAUDE.md の補完であり、移動・置換ではない |

**rules 設計の原則**: CLAUDE.md に横断的な内容を置き、rules には「そのパスを編集するときだけ必要な知識」を追加する。

### tools 層

Claude Code が使う専門知識とワークフローの定義。

**エージェント（専門知識の領域）**:

| エージェント | 専門領域 | 主な利用場面 |
| --- | --- | --- |
| `po` | プロダクト価値・JTBD | プロダクト判断・要件レビュー |
| `pm` | プロジェクト管理 | 進捗分析・リスク管理 |
| `architect` | 構造設計・ADR 整合性 | 設計レビュー・実装レビュー |
| `qa` | 品質保証・テスト設計 | テストレビュー・実装レビュー |
| `designer` | UI/UX・ブランド | UX レビュー |

エージェントは「行為」ではなく「専門知識の領域」として定義する（ADR-0011）。レビューはエージェントの組合せで表現する。

**スキル（定型作業の自動化）**: 繰り返し実行され手順が定型化できる作業を slash command として実装する（[CLAUDE.md](../../CLAUDE.md) のスコープ定義を参照）。

### automation 層

tool call に連動して自動実行される副作用。

| hook | トリガー | 処理 |
| --- | --- | --- |
| `post-edit-lint.sh` | Edit / Write ツール実行後 | 編集ファイルが `*.ts` / `*.tsx` の場合、biome で自動 lint & format |

PostToolUse hook が ADR-0007 品質保証の「第 3 層フィードバックループ Phase 1」を実現する。Stop hook・PreToolUse hook は現時点で導入しない（コスト > 効果）。

### integration 層

外部ツールとの連携。`.mcp.json` および `settings.json` の `enabledMcpjsonServers` で制御する。

| MCP サーバー | 用途 |
| --- | --- |
| `context7` | ライブラリ・フレームワーク公式ドキュメントの参照 |
| `playwright` | 実装中の UI 動作確認（E2E テストではない。[ai-ui-verification.md](./ai-ui-verification.md) を参照） |

### safety 層

`settings.json` の `permissions` で tool 呼び出しの許可・拒否を管理する。

- **allow**: 許可パターンを明示列挙（デフォルト拒否）。`Bash(git push --force:*)` 等の破壊的操作は deny に明示する
- **deny**: `.env` 読み取り・`rm -rf`・`curl/wget`・`git reset --hard` 等
- **運用**: 数セッション後に `/fewer-permission-prompts` スキルで使用ログを分析し、allowlist を随時更新する

### observability 層

`settings.json` の `statusLine` でステータスバーに現在のコンテキストを表示する。`.claude/status-line-command.sh` が実装する。

## 追加判断ガイド

### rule を追加するとき

**判断基準**: 特定のファイルパスを編集するときだけ必要な制約・知識があるか。

```yaml
# .claude/rules/新ルール.md の frontmatter 例
---
paths:
  - "対象パス/**"
---
```

注意: CLAUDE.md に書くべき横断的な内容を rules に移さない。

### skill を追加するとき

**判断基準**: 「繰り返し実行され、手順が定型化できる作業」か（ADR-0007）。

```yaml
# SKILL.md の frontmatter 例
---
name: スキル名
description: 一文で用途を説明
when_to_use: ユーザーが〜と言ったとき
allowed-tools: Read Edit Write Bash(...)
---
```

skills/ はユーザーが trigger する slash command として機能する。agents/ から委譲されることもある。

### agent を追加するとき

**判断基準**: 既存の 5 エージェント（PO/PM/Architect/QA/Designer）でカバーできない独立した専門知識の領域があるか（ADR-0011）。「行為」ではなく「専門領域」として定義できるか。

```yaml
# .claude/agents/新エージェント.md の frontmatter 例
---
name: エージェント名
description: 専門領域の説明（tools ではなく知識・視点を記述）
---
```

### hook を追加するとき

**判断基準**: tool call に連動して毎回自動実行すべき副作用があるか。人間の確認なしに安全に実行できるか。

`settings.json` に `hooks` エントリを追加し、スクリプトは `.claude/hooks/` に配置する。hook は常に `exit 0` で終了し、処理ブロックを起こさない。

## 参照

| ドキュメント | 内容 |
| --- | --- |
| [ADR-0007](../adr/0007-ai-driven-dev-architecture.md) | ハイブリッドエージェント方式・チェックポイントモデル・品質保証 3 層構成の採択理由 |
| [ADR-0011](../adr/0011-role-based-agent-architecture.md) | エージェントを「専門知識の領域」として定義する設計原則 |
| [ADR-0013](../adr/0013-doc-placement-policy.md) | docs/product/ と docs/design/ の配置ポリシー |
| [ADR-0024](../adr/0024-playwright-mcp-for-ai-verification.md) | Playwright MCP 採択理由 |
| [docs/principles/README.md](../principles/README.md) | 設計・開発原則の SSoT |
| [devcontainer.md](./devcontainer.md) | DevContainer 構成・DB モード・認証共有 |
| [worktree.md](./worktree.md) | Git Worktree 並行セッション運用 |
