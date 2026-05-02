# DevContainer 運用ガイド

AI 駆動開発（Claude Code）と PostgreSQL を統合した DevContainer の利用手順。

意思決定の背景は [ADR-0016](../adr/0016-devcontainer-integration.md) と [ADR-0018](../adr/0018-relocate-compose-and-consolidate-env.md) を参照。worktree との使い分けは [worktree.md](./worktree.md) を参照。

## 構成

リポジトリ直下のファイル構成（DevContainer 関連）：

```text
.
├── docker-compose.yml      # app + db のサービス定義（ルート配置）
├── Dockerfile              # app の image 定義（ベース + /home/node/.claude の事前作成）
├── .dockerignore           # build context 縮小（node_modules / .git / docs 等を除外）
├── .env.example            # 環境変数テンプレート（DB 部品 + ポート + DB_VOLUME）
└── .devcontainer/
    └── devcontainer.json   # VS Code Dev Containers の設定（../docker-compose.yml を参照）
```

サービス：

| サービス | 用途 | 既定ポート |
| --- | --- | --- |
| `app` | 開発用コンテナ（`Dockerfile` でベース image をビルド + bun, gh, claude-code を features で追加） | 3000 |
| `db` | PostgreSQL 18（healthcheck 付き） | 5432 |

`Dockerfile` でベース image に `/home/node/.claude` を node 所有で事前作成しているのは、`agent-team-studio-claude-home` named volume が初回マウント時に root:root で作られないようにするため（Docker は image 内マウント先の所有権を volume にコピーする仕様）。詳細は [ADR-0016](../adr/0016-devcontainer-integration.md) 参照。

永続化される named volume：

| 名前 | 用途 |
| --- | --- |
| `agent-team-studio-claude-home` | Claude Code の `~/.claude/` 配下（プロジェクトメモリ・個人 skills/agents・設定・OAuth トークン）。全 DevContainer で共有 |
| `agent-team-studio-pgdata-<name>` | PostgreSQL のデータ。`DB_VOLUME` で worktree ごとに切替可 |

## 初回セットアップ

```bash
# .env をルートに作成（compose の variable interpolation 元 + ホストツール用 SSoT）
cp .env.example .env
```

VS Code でリポジトリを開き、コマンドパレットから「Dev Containers: Reopen in Container」を実行する。初回は compose のイメージ取得とボリューム作成で数分かかる。

コンテナ内でターミナルを開き、Claude Code に初回ログインする：

```bash
claude login
```

認証情報は `agent-team-studio-claude-home` volume の `~/.claude/.credentials.json` に書き込まれ、以後同じ DevContainer の再起動では再ログイン不要。worktree との共有範囲は次節を参照。

## Claude ホームの共有

`agent-team-studio-claude-home` named volume を `/home/node/.claude` にマウントし、Claude Code の `~/.claude/` 配下を全 DevContainer で共有・永続化する。**主目的はプロジェクトメモリ（`projects/`）・個人 skills/agents・設定の永続化と worktree 間共有** で、認証情報はその副次的成果。OS 非依存。

共有範囲：

| 操作 | 再ログインの要否 |
| --- | --- |
| 同じ DevContainer の再起動・Stop/Start | 不要 |
| nested モード（`claude -w`、コンテナ内 worktree） | 不要 |
| **split モード（worktree ごとに新規 DevContainer）** | **必要（コンテナ作成時に 1 回）** |
| `Rebuild Container` した場合 | 必要 |

split モードと Rebuild で再ログインが必要になる理由は、Claude Code が **ログイン状態の一部を `~/.claude.json`（ホーム直下のファイル）に保存している** ため。このファイルは `/home/node/.claude/` ディレクトリの **外** にあり、named volume の共有対象外。本ファイルをコンテナ間で共有する案（symlink 等）は Claude Code の書き込み挙動により壊れるリスクがあり、現段階では運用で許容する判断（詳細は [ADR-0016](../adr/0016-devcontainer-integration.md) Consequences 参照）。

トークンが期限切れになった場合：

```bash
# どれか1つの DevContainer で
claude logout
claude login
# → agent-team-studio-claude-home volume が更新され、認証トークンは全コンテナに反映
```

認証を完全リセットしたい場合：

```bash
docker volume rm agent-team-studio-claude-home
# 次回 claude login から再開
```

## DB 接続の構造

### 部品方式

`.env` には DB の部品（接続情報の素材）だけを置き、`DATABASE_URL` は `docker-compose.yml` の `environment:` で組み立てて app コンテナに注入する。

```env
# .env
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=agent_team_studio
DB_PORT=5432
```

```yaml
# docker-compose.yml（抜粋）
services:
  app:
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}
  db:
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
```

これにより app と db が常に同じ部品から派生するため不整合が起きない。アプリ側のルール（`process.env.DATABASE_URL` のみ参照する等）は [env.md のルール](./env.md#ルール) を参照。

### 接続元別の host / port

| 接続元 | host | port |
| ------ | ---- | ---- |
| container 内（既定） | `db`（compose のサービス名） | `5432`（コンテナ内 listen ポート、固定） |
| ホストから直接（psql 等） | `localhost` | `.env` の `DB_PORT`（既定 `5432`） |

ホストから直接接続する場合は、`.env` の部品を組み立てて `psql` の引数に渡すか、必要に応じて手動で `DATABASE_URL` 環境変数を export する。

DB 操作ツール（`psql` / Drizzle Studio / PostgreSQL VSCode 拡張）の使い方は [development-tools.md](./development-tools.md) を参照。

## DB のモード切替

ルート `.env` の `DB_VOLUME` で PostgreSQL の named volume を選択する。

### 共有モード（既定）

複数の worktree で同じ DB を参照する。読取中心や軽微な変更のときに使う。

```bash
# .env
DB_VOLUME=agent-team-studio-pgdata-main
```

> nested で DB スキーマを変更する場合は main DB を汚さないように `search_path` を worktree 名で切るか `CREATE DATABASE wt_<name>` で別 DB を作ること。詳細は [worktree.md](./worktree.md) のカテゴリ C を参照。

### 隔離モード

worktree ごとに独立した DB を起動する。破壊的スキーマ変更・マイグレーション rollback 検証・大規模 seed の試行に使う。

```bash
# 例: feat-auth worktree 内で
DB_VOLUME=agent-team-studio-pgdata-feat-auth
DB_PORT=5442
```

worktree のライフサイクル: `git worktree remove` する **前に** `docker volume rm <DB_VOLUME>` を実行して volume を削除する。残したまま worktree を消すと孤立 volume が増殖する。

```bash
# ホスト側ターミナルから実行

# 0. 実際の compose プロジェクト名を確認（VS Code Dev Containers 経由で起動した場合は
#    devcontainercli が独自形式のプロジェクト名を生成しているため、standalone と一致しないことがある）
docker compose ls
# または: docker ps --filter name=feat-auth

# 1. コンテナを停止する（停止後でないと volume 削除は volume is in use エラーになる）
#
#    (a) standalone で起動した場合
cd ../agent-team-studio--feat-auth
docker compose down
#
#    (b) VS Code Dev Containers から起動して上の down が空振りする場合
#        VS Code コマンドパレットから「Dev Containers: Stop Container」を実行する

# 2. named volume は down では削除されないので明示的に削除
docker volume rm agent-team-studio-pgdata-feat-auth

# 3. メインリポジトリへ戻って worktree を削除
cd ../agent-team-studio
# 未コミット変更がある場合は先に git -C ../agent-team-studio--feat-auth stash を実行
# （失われても問題なければ git worktree remove --force ... で強制削除も可）
git worktree remove ../agent-team-studio--feat-auth
```

## ポート割当

worktree を並行起動する場合、ホスト側のポート衝突を避けるために ルート `.env` でオフセットする。命名規約は **+10 オフセット**：

| ツリー | APP_PORT | DB_PORT |
| --- | --- | --- |
| main | 3000 | 5432 |
| worktree 1 | 3010 | 5442 |
| worktree 2 | 3020 | 5452 |

アプリは **コンテナ内では常に 3000 で listen** する固定設計。`APP_PORT` はホスト側へ公開するポートのみを切替える（compose の `ports` マッピングで `${APP_PORT}:3000` に変換）。

```ts
// 擬似コード（コンテナ内 listen ポートは固定）
const port = 3000;
```

### ホスト側ポート（`APP_PORT` / `DB_PORT`）とコンテナ内ポートの違い

ホスト ↔ コンテナ間のフォワーディング用ポート（`APP_PORT` / `DB_PORT`）は worktree ごとに切替が必要だが、コンテナ内の listen ポート（`@db:5432` / app の 3000）は常に固定。`DATABASE_URL` の `@db:5432` も同様で、`DB_PORT` を変えても変更不要。

`devcontainer.json` の `forwardPorts: [3000, 4983, 5432]` は **solo モード向けの定義**（4983 は Drizzle Studio 用）。split モードで `APP_PORT=3010` / `DB_PORT=5442` などに変更しても自動追従しないが、compose の `ports` がホストレベルでポートをバインドするため VS Code の `forwardPorts` とは独立して機能し実害はない（VS Code のポート転送 UI に main の値が見えるだけ）。

## Playwright の利用

Playwright は本 ADR-0016 のスコープ外（後続 Issue で導入予定）。正式導入後は ルート `.env` のポート設定を `playwright.config.ts` の dev server に渡す構成を想定する。詳細な使い分け（軽量 / 視覚デバッグ / 並行 E2E）は [worktree.md](./worktree.md) のユースケースマトリクスを参照。

ブラウザの依存パッケージとイメージへの組み込みも、Playwright 正式導入時に DevContainer の features またはイメージに追加する。

## トラブルシューティング

| 症状 | 対処 |
| --- | --- |
| ポートが衝突する | ルート `.env` の `APP_PORT` / `DB_PORT` をオフセットする |
| DB に接続できない | `docker compose ps` で `db` の healthcheck 状態を確認 |
| 認証が切れた | `claude logout && claude login` で `agent-team-studio-claude-home` volume を更新 |
| DB を初期化したい | `docker volume rm <DB_VOLUME>` してから DevContainer を再起動 |
| コンテナを作り直したい | VS Code コマンドパレットから「Dev Containers: Rebuild Container」を実行 |
| worktree が増えてリソース不足 | 使わない DevContainer は `docker compose stop` で休眠（削除はしない） |

> ⚠️ **`docker compose down -v` の注意**: `-v` オプションは compose ファイルで宣言した named volume（`agent-team-studio-claude-home` と `agent-team-studio-pgdata-<name>` の両方）を削除する。誤って実行すると Claude ホーム（プロジェクトメモリ・認証）と DB データが両方失われる。Claude ホームを残したい場合は `docker volume rm agent-team-studio-pgdata-<name>` で個別に削除する。
