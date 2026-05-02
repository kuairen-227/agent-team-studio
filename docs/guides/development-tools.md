# 開発ツール運用ガイド

DevContainer 内で利用する開発ツールの構成と使い方。DB 接続そのものの構造（`DATABASE_URL` の組み立て、host/port の使い分け、worktree ごとの隔離）は [devcontainer.md](./devcontainer.md) を参照。

意思決定の背景は Issue #96 を参照。

## ツール構成

| 用途 | ツール | 導入経路 |
| --- | --- | --- |
| AI / 人間が DB を CLI で操作 | `psql`（PostgreSQL 公式クライアント） | `.devcontainer/post-create.sh` で `apt-get install postgresql-client` |
| 人間が DB を GUI で日常的に閲覧（Drizzle 視点） | Drizzle Studio | `bun run --cwd packages/db db:studio` |
| 人間が DB に対して自由な SQL を書く / プラン可視化 | PostgreSQL 拡張（Microsoft 公式 `ms-ossdata.vscode-pgsql`） | `.devcontainer/devcontainer.json` の `extensions` |

各ツールは役割が直交する。Drizzle Studio は型と統合された日常使い、PostgreSQL 拡張は SQL 自由度（IntelliSense / プラン表示 / Copilot 連携）の補完、`psql` は AI も人間も等しく使えるスクリプタブル CLI。

## psql

### インストール

`.devcontainer/post-create.sh` 内で自動インストールされる。DevContainer Rebuild 後は `psql` コマンドが利用可能。

```bash
psql --version
# => psql (PostgreSQL) 17.x
```

> クライアント版は Debian 標準リポジトリの 17 系。サーバー（Postgres 18）と異なるが、`psql` は跨ぎバージョンで動作するため通常用途では問題ない。

### 基本的な使い方

`DATABASE_URL` は app コンテナに自動注入されるため、引数不要で接続できる。

```bash
# 接続して対話モードに入る
psql "$DATABASE_URL"

# ワンライナーで実行
psql "$DATABASE_URL" -c "SELECT count(*) FROM templates;"

# ファイルから SQL を流す
psql "$DATABASE_URL" -f path/to/script.sql
```

### AI（Claude）からの使い方

`bun -e` で都度 SQL 文字列を組み立てる方式に比べて context 消費が少なく、シンタックスハイライトを伴う出力が得られる。確認系クエリは `psql -c` のワンライナーを基本とする。

## Drizzle Studio

### 起動

```bash
bun run --cwd packages/db db:studio
```

ターミナルに `https://local.drizzle.studio` の URL が表示される。VS Code のポート転送（`forwardPorts: 4983`）経由でホストのブラウザから開ける。

`Ctrl+C` で停止。

### 用途

- スキーマ定義（`packages/db/src/schema/`）と統合された型安全な閲覧
- テーブルのレコードを表形式で確認・編集
- 開発中のシード状態のクイックチェック

### 制限

Drizzle Studio 自体は Beta。複雑な JOIN や `EXPLAIN` などは PostgreSQL 拡張または `psql` を使う。

## PostgreSQL VSCode 拡張（Microsoft 公式）

### 自動インストール

`.devcontainer/devcontainer.json` の `customizations.vscode.extensions` に `ms-ossdata.vscode-pgsql` を含めているため、DevContainer を開いた時点で自動インストールされる。

### 接続プロファイル

`.vscode/settings.json` にワークスペース共通の接続プロファイルを保存している。コンテナ内の `db:5432` を指す既定値で、初回利用時にパスワードを入力すれば接続できる（`.env` の `POSTGRES_PASSWORD`、デフォルト `postgres`）。

| 項目 | 値 |
| --- | --- |
| Server | `db`（compose のサービス名） |
| Port | `5432`（コンテナ内 listen ポート、固定） |
| User | `postgres` |
| Database | `agent_team_studio` |

> このプロファイルは **コンテナ内専用**。ホスト側から繋ぐ場合は `localhost` + `.env` の `DB_PORT` を使い、別プロファイルを作成する。

### 主な機能

- SQL の IntelliSense（テーブル名・カラム名補完）
- クエリ結果の CSV / JSON / Excel エクスポート
- `EXPLAIN` のクエリプラン可視化
- GitHub Copilot 連携（`@pgsql` でスキーマを踏まえた SQL 提案）

`.vscode/settings.json` の `pgsql.connections[].copilotAccessMode` で Copilot のアクセス範囲を制御できる（`rw` / `r` / 無効）。

## トラブルシューティング

| 症状 | 対処 |
| --- | --- |
| `psql` が見つからない | DevContainer Rebuild 後に `bash .devcontainer/post-create.sh` が実行されたか確認。手動再実行も可 |
| Drizzle Studio がブラウザで開けない | VS Code の「ポート」タブで 4983 が転送されているか確認。されていなければ手動で追加 |
| PostgreSQL 拡張が接続できない | `.env` の `POSTGRES_PASSWORD` と入力値が一致しているか確認。コンテナ内からは host が `db`（`localhost` ではない） |

## 関連

- [devcontainer.md](./devcontainer.md) — DevContainer 構成・DB 接続の構造・worktree ごとの隔離
- [env.md](./env.md) — 環境変数のルール
- Issue #96 — 本ガイドの整備経緯
