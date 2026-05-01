# 0016. DevContainer の統合構成（compose + features + Claude ホーム共有 volume）

## Status

accepted（一部 superseded by [ADR-0018](./0018-relocate-compose-and-consolidate-env.md)）

- 作成日: 2026-04-29
- 関連: ADR-0008（前提：技術スタック）, ADR-0012（前提：Worktree）, [ADR-0018](./0018-relocate-compose-and-consolidate-env.md)（compose / Dockerfile / `.env` の配置を上書き）, Issue #87, Issue #77（後続）

> [!NOTE]
> 本 ADR の決定のうち **compose / Dockerfile / `.env` を `.devcontainer/` 配下に集約する** 部分は ADR-0018 で更新された。Claude ホーム共有 volume・DB 隔離モード・ポート割当の判断は本 ADR のまま有効。

## Context

ADR-0008 で技術スタックを確定した時点で、PostgreSQL を DevContainer に追加する旨が予告されていた（#12 / #77 で実体化予定）。一方 ADR-0012 で Claude Code の `claude -w` ネイティブ worktree と手動 `git worktree add` の併用方針が決まっており、後続の DB 環境整備（#77）と Walking Skeleton 実装の前提として、DevContainer の構成方式・Claude ホーム共有・worktree との接続方法を一括で決める必要がある。

決めるべき論点は以下：

1. DevContainer の構成方式（features 単独 / Dockerfile / docker-compose / ハイブリッド）
2. Claude Code のホーム（`~/.claude/`）共有方式（プロジェクトメモリ・個人カスタマイズの永続化、認証情報の扱い）
3. worktree（`claude -w` / 手動）と DB・Playwright 等の共有資源との接続方法

学習プロジェクトの状況設定（ADR-0002：PM 1名 + エンジニア 1名 + AI、社内クラウド承認制）と、ローカル PC のリソース制約を前提に検討した。

## Considered Alternatives

### DevContainer の構成方式

| # | 選択肢 | 判定 |
| - | --- | --- |
| A | features 単独（現行） | 却下 — 設定は最小だが、PostgreSQL 等の複数サービス統合が不可能 |
| B | Dockerfile | 却下 — ビルド完全制御は得られるが、外部サービス統合は別途必要で利点が少ない |
| C | docker-compose 単独 | 却下 — 複数サービス統合は容易だが、CLI ツール（gh, claude-code, bun）導入が手間 |
| D | docker-compose + features ハイブリッド | **採用** — app コンテナはベースイメージ + features で軽量に組み、db や将来追加サービスは compose で統合する。両者の利点を活かせる。なお、後述する named volume の所有権継承の都合で薄い `Dockerfile` を併用する（B 案を全面採用するわけではなく、ベースイメージへの最小限の追加に限定） |

### Claude Code のホーム（`~/.claude/`）共有方式

| # | 選択肢 | 判定 |
| - | --- | --- |
| A | ホスト `~/.claude` bind mount | 却下 — OS 依存・ホスト汚染のリスク |
| B | named volume（`agent-team-studio-claude-home`） | **採用** — OS 非依存、複数 worktree コンテナ間で `~/.claude/` 配下（プロジェクトメモリ・個人 skills/agents・設定）を共有可。認証情報の一部（`~/.claude.json`）は対象外で再ログインが必要だが、メモリ・カスタマイズの永続化と worktree 間共有が主目的 |
| C | `ANTHROPIC_API_KEY` 環境変数 | 却下 — OAuth プラン（Pro/Max）を使えずコスト不利 |
| D | dotfiles リポジトリ | 却下（単独では） — Claude ホーム配下のランタイム状態の保存には適さない |

### worktree と DB の接続方法

| # | 選択肢 | 判定 |
| - | --- | --- |
| A | 単一 DB を全 worktree で共有（隔離なし） | 却下 — 破壊的スキーマ変更で main 作業を汚染する |
| B | DB volume を worktree ごとに切り替え可能にする | **採用** — `.devcontainer/.env` の `DB_VOLUME` で named volume を差し替え。共有モード（同一 volume）と隔離モード（worktree 別 volume）を選択できる |
| C | DB を worktree ディレクトリ内のローカル data dir で起動 | 却下 — bind mount 経由の PostgreSQL data dir はパフォーマンス・互換性の問題が起きやすい |

### worktree と Playwright の接続方法

| # | 選択肢 | 判定 |
| - | --- | --- |
| A | 単一コンテナで全 worktree 共有（dev server ポート1つ） | 却下 — 並行 E2E でポート衝突 |
| B | `.devcontainer/.env` でポートを worktree 単位に切替 | **採用** — `APP_PORT` / `DB_PORT` をオフセットすることで複数 worktree のコンテナを並行起動できる |

## Decision

### DevContainer 構成（D 案 = ハイブリッド）

- `.devcontainer/devcontainer.json` で `dockerComposeFile` を参照
- `.devcontainer/docker-compose.yml` に以下のサービスを定義
  - `app`: `.devcontainer/Dockerfile` でビルド（ベース `mcr.microsoft.com/devcontainers/javascript-node:24` + `/home/node/.claude` の事前作成）。features で `gh-cli` / `claude-code` / `bun` を追加
  - `db`: `postgres:18`（2025 年秋 GA 版を採用）、healthcheck 付き
- `.devcontainer/.env`（gitignore 対象）で worktree 単位の値を上書き

Dockerfile を導入する理由は次節「Claude ホーム共有」を参照（named volume の所有権継承のため image 内に node 所有のディレクトリを事前作成する必要がある）。

### Claude ホーム共有（B 案 = named volume）

- compose で `agent-team-studio-claude-home` という named volume を定義し、`/home/node/.claude` にマウント（compose 内の論理名は `claude-home`）
- 複数プロジェクトとの volume 名衝突を避けるため、実 volume 名にはプロジェクト名 `agent-team-studio-` を prefix する
- 主目的は **プロジェクトメモリ（`projects/`）・個人レベルの skills/agents・設定の永続化と worktree 間共有**。Rebuild Container しても会話履歴やカスタマイズが残り、split worktree 間でも `/workspaces/agent-team-studio` 絶対パスをキーとしたメモリが共有される
- 認証共有は副次的目的。OAuth トークン（`~/.claude/.credentials.json`）は volume 内だが、ログイン状態の一部（`~/.claude.json`）はディレクトリ外にあり共有できない。詳細は Consequences 参照
- Docker は named volume 初回マウント時に **image 内マウント先ディレクトリの所有権を volume にコピー** するため、image 段階で `mkdir -p /home/node/.claude && chown node:node /home/node/.claude` を実行する（実装は `.devcontainer/Dockerfile`）。これがないと volume が root:root で作られ、`node` ユーザーから書き込めず `claude login` が silent fail する

### DB の隔離モード切替（B 案）

- `.devcontainer/.env` の `DB_VOLUME` で PostgreSQL の named volume を選択（プロジェクト名 prefix 付き）
  - 共有モード: `DB_VOLUME=agent-team-studio-pgdata-main`（複数 worktree で同一 DB を参照）
  - 隔離モード: `DB_VOLUME=agent-team-studio-pgdata-<worktree-name>`（破壊的スキーマ変更を main から隔離）
- 併せて `WORKTREE_ID` をコンテナに環境変数として渡す。将来のアプリケーション側 worktree 識別（`search_path` の動的切替・`CREATE DATABASE wt_<id>` の自動化等）を想定した予約変数で、現時点ではアプリ参照箇所なし
- 切替手順は `docs/guides/devcontainer.md` に明記する

### ポート割当（B 案）

- `.devcontainer/.env` で `APP_PORT` / `DB_PORT` を定義
- worktree ごとに +10 オフセットを命名規約として採用（main: 3000/5432、worktree-1: 3010/5442、…）

### Worktree との使い分けルール

ADR-0012 で採用済みの `claude -w` と手動 `git worktree add` の使い分けに、本決定で導入する DB 隔離モード・ポート割当を組み合わせた運用ルールを `docs/guides/worktree.md` に明記する。判断軸は以下の通り：

- **main 単一作業 / 軽量タスク** → 単一 DevContainer（`solo`）
- **AI 並行・短命タスク・読取中心 / 軽微な DB 変更** → `claude -w`（`nested`、DB 共有モード）
- **DB 破壊的変更 / Playwright 視覚デバッグ / 並行 E2E / 大規模リファクタ** → `git worktree add` + 別 DevContainer + DB 隔離モード（`split`）

## Consequences

- DevContainer の起動時間は features 単独構成より長くなる（compose でのイメージ取得 + healthcheck 待ち）
- PostgreSQL がローカル開発で常時起動するため、メモリ消費が増える
- worktree 単位で DevContainer を起動する運用は、ローカル PC の CPU / メモリを大きく消費する（split worktree は同時 2 つまでが現実的な上限。main 含めて最大 3 コンテナ）
- Claude ホーム（プロジェクトメモリ・個人 skills/agents・OAuth トークン等）が named volume に永続化されるため、ホスト OS 非依存。コンテナへのアクセス権を持つすべてのプロセスから読み取り可能（ローカル開発専用・シングルユーザー前提のため許容する。チーム拡張時は別途分離方式を検討する）
- Claude Code は OAuth トークン（`~/.claude/.credentials.json`）に加えてログイン状態の一部を `~/.claude.json`（ホーム直下のファイル、`.claude/` ディレクトリの外）に保存するが、このファイルは named volume の共有対象外のため、split モード（worktree ごとに別 DevContainer を起動）と Rebuild Container 時には再ログインが必要になる。symlink で共有する案を検討したが Claude Code の書き込みパターン（atomic rename / unlink+create）で symlink が壊れるリスクがあり、初期段階では運用で許容する判断。将来 Claude Code が `CLAUDE_HOME` 等のカスタマイズを提供すれば再検討する
- `.devcontainer/.env` を gitignore 対象とすることで、ポート / DB volume 等の個人差を git に持ち込まずに済む
- Issue #77（DB 環境整備）の前提が解消され、Drizzle ORM のスキーマ定義・マイグレーションの実装に着手できる
- ADR-0008 で予告されていた「PostgreSQL コンテナの追加」が本決定で実体化する
- 既存の ADR-0012 とは矛盾せず、worktree 運用ルールに DB / ポートに関する詳細を追加する形で接続する
