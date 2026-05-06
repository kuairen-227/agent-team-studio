# 0018. docker-compose / Dockerfile をリポジトリルートに配置し、env を部品方式に統合する

## Status

accepted（部分的に supersedes [ADR-0016](./0016-devcontainer-integration.md)）

- 作成日: 2026-05-01
- 関連: ADR-0016（supersedes 部分）, Issue #77

## Context

ADR-0016 で DevContainer の構成を `docker-compose + features + Claude ホーム共有 volume` のハイブリッドに決定し、`docker-compose.yml` / `Dockerfile` / `.env`（worktree 単位の上書き用）を `.devcontainer/` 配下に集約した。Issue #77 で DB 環境整備を進める過程で、以下の運用上の問題点が顕在化した：

- **`.env` の二重化**: compose の variable interpolation 用 `.devcontainer/.env`（ポート / DB_VOLUME / POSTGRES_*）と、ホスト直接接続ツール用 `.env`（DATABASE_URL）が並立し、どちらに何が書かれるべきか曖昧
- **`.env.example` の DATABASE_URL の扱い**: container 内では compose の `environment:` で組み立てられた値が注入されるため、リポジトリルート `.env` の `DATABASE_URL` は使われない。それでも「コピーで動作する」状態にするため動作する接続文字列を commit する案は secretlint との衝突を招く
- **CLI 体験**: `docker compose ...` を直接打つには `-f .devcontainer/docker-compose.yml` を毎回付ける必要がある

これらは ADR-0016 の方針自体を覆すものではなく、実装時に判明した配置上の問題を解消するための変更として整理する。

## Considered Alternatives

### compose / Dockerfile の配置

| # | 選択肢 | 判定 |
| - | --- | --- |
| A | `.devcontainer/` 配下を維持（現状） | 却下 — ルート `.env` を compose が自動読み込みできず、二重化が解消しない |
| B | リポジトリルートへ移動 | **採用** — compose は同じディレクトリの `.env` を自動読み込みするため、ルート `.env` を SSoT にできる。`docker compose ...` も `-f` 不要で実行可能 |

### env の構造

| # | 選択肢 | 判定 |
| - | --- | --- |
| A | `.env` に組み立て済み `DATABASE_URL` を置く | 却下 — secretlint の PostgreSQLConnection ルールに引っかかり allowlist が必要。さらに container 内では compose の `environment:` 注入が優先されるため、`.env` の値は実質的に使われない（飾りになる） |
| B | `.env` に部品（`POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB`）のみ置き、compose 側で組み立てる | **採用** — secretlint と素直に共存（接続文字列としては検出されない）。app コンテナ・db コンテナ双方が同じ部品から派生するため不整合が起きない |

### `.devcontainer/.env` の扱い

| # | 選択肢 | 判定 |
| - | --- | --- |
| A | 維持（worktree 単位の上書き用） | 却下 — ルート `.env` で同様の上書きが可能。worktree のディレクトリは独立しているため（[ADR-0012](./0012-git-worktree-parallel-sessions.md)）、各 worktree が自分のルート `.env` を持つ形で十分機能する |
| B | 廃止しルート `.env` に統合 | **採用** — 真実の場所が一つになり、compose の自動読み込みとも整合 |

## Decision

### 配置

- `docker-compose.yml` と `Dockerfile` を **リポジトリルートに移動** する
- `.devcontainer/` には `devcontainer.json` のみ残し、`dockerComposeFile: "../docker-compose.yml"` で参照する
- `.devcontainer/docker-compose.yml` / `.devcontainer/Dockerfile` / `.devcontainer/.env.example` は削除する

### env 構造

- ルート `.env`（`.env.example` をコピー）に以下を置く
  - DB 部品: `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB`
  - DevContainer / Worktree 単位の上書き値: `WORKTREE_ID` / `APP_PORT` / `DB_PORT` / `DB_VOLUME`
  - 必要に応じて API 系: `LLM_API_KEY` 等（必須はプレースホルダー形式、任意は `LLM_BASE_URL` のようにコメント形式で例示）
- `DATABASE_URL` は `.env` には書かず、`docker-compose.yml` 内の `environment:` で `postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}` として組み立てて app コンテナに注入する
- アプリ実装側は `process.env.DATABASE_URL` のみを参照する（部品から組み立てる責務は compose が持ち、アプリ側で組み立てない）
- secretlint の database-connection-string allowlist は撤回する

### build context

- ルートを build context にすることで `node_modules` / `.git` / `_dev` 等が Docker daemon に送信される事態を避けるため、`.dockerignore` をルートに新規作成する

### DB volume のマウント先

- `pgdata` named volume のマウント先は `/var/lib/postgresql` とする（`/var/lib/postgresql/data` ではない）
- 理由: PostgreSQL 18 の公式 Docker image では `VOLUME` 宣言が `/var/lib/postgresql/data`（PostgreSQL 17 以前）から `/var/lib/postgresql` に変更され、`PGDATA` も version-specific subdirectory（`/var/lib/postgresql/18/docker`）に変わった。これは `pg_upgrade --link` を mount point 境界問題なく使えるようにするための設計変更（[公式 Dockerfile 参照](https://github.com/docker-library/postgres/blob/master/18/bookworm/Dockerfile)）
- PostgreSQL 17 以前の慣例で `pgdata:/var/lib/postgresql/data` を指定すると、公式 image が想定するディレクトリ構造から外れて動作するため避ける

### Worktree との接続

ADR-0016 で決めた worktree 隔離・ポート割当の運用は維持。実体として参照する env ファイルが `.devcontainer/.env` から ルート `.env` に変わるのみ。

## Consequences

- ルート `.env` が compose・app コンテナ・ホスト直接ツールすべての SSoT になり、二重管理が解消される
- `.env.example` のコピーだけでオンボーディング完了。secretlint allowlist の追加メンテナンスも不要
- `docker compose ...` を `-f` なしで実行できるようになり、CLI 体験が標準的になる
- compose の variable interpolation には fallback（`${VAR:-default}`）を **付けず**、必須 env は `${VAR:?env_required}` 構文で参照する。これにより `.env` 不在 / 必須変数が未定義 or 空の場合は compose 起動時に即エラーで停止する（fail fast）。デフォルト値は `.env.example` のみが持ち、二重管理を避ける
- container 内で Bun は CWD（`/workspaces/agent-team-studio`）の `.env` を auto-load する。compose の `environment:` で注入された `DATABASE_URL` は process.env に既に存在するため Bun は上書きしないが、`.env` に書かれた `POSTGRES_*` 部品は container 内 process.env からも参照可能になる。アプリ実装側では原則 `DATABASE_URL` のみを参照することを `docs/guides/env.md` に明記する
- `.env.example` の `POSTGRES_PASSWORD=postgres` 等の既定値は **ローカル開発専用** の前提に立つ。本番環境では別途シークレット管理（GitHub Secrets / SecretManager 等）で値を上書きすること。compose ファイル自体に書き込んでいないため、worktree や本番でも別の値を `.env` 経由で安全に注入できる
- ADR-0016 の `.devcontainer/` 配下集約方針はこの ADR で部分的に上書きされる（compose / Dockerfile / `.env` の配置のみ）。Claude ホーム共有 volume / DB 隔離モード / ポート割当の判断はそのまま有効
- VS Code Dev Containers 拡張は `dockerComposeFile` のパス変更を契機に compose project 名を再生成するため、**既存の DevContainer は Rebuild Container が必要**。`agent-team-studio-claude-home` / `agent-team-studio-pgdata-*` の named volume は `name:` 明示によって維持されるが、`~/.claude.json`（ディレクトリ外、共有対象外）の都合で `claude login` は再実行が必要になる場合がある
- `.dockerignore` の維持責任が発生する（追加ディレクトリを除外したいときに更新が必要）
- `image: postgres:18` は floating tag のため `docker compose pull` でメジャー 18 系のマイナー / パッチが自動更新される。ローカル開発専用として許容する判断。バージョン固定が必要な場面（再現性が要る検証等）が出てきた場合は `postgres:18.x` 形式に変更する
- 将来 production 用 Dockerfile を別途追加する場合、ルートに `Dockerfile` が既にあるため命名規約（例: `Dockerfile.dev` / `Dockerfile.prod`）が必要になる。本 ADR ではその範囲は扱わず、必要時に別途決定する
