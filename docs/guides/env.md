# 環境変数・シークレット管理ガイド

## セットアップ

```bash
cp .env.example .env
```

`.env` に実際の値を設定する。`.env` は `.gitignore` に含まれ、リポジトリには追跡されない。

## ファイルの使い分け

| ファイル | 用途 | Git 追跡 |
| ---------- | ------ | ---------- |
| `.env.example` | テンプレート（キー名のみ、値は空orダミー） | する |
| `.env` | ローカル開発用の実際の値 | しない |
| `.env.local` | 個人設定の上書き | しない |

## 命名規約

- **UPPER_SNAKE_CASE** を使用する（例: `DATABASE_URL`）
- プレフィックスでカテゴリを示す

| プレフィックス | 用途 | 例 |
| ---------------- | ------ | ----- |
| `DATABASE_` | データベース接続 | `DATABASE_URL` |
| `ANTHROPIC_` | Claude API | `ANTHROPIC_API_KEY` |
| `AUTH_` | 認証・認可 | `AUTH_SECRET` |

プレフィックスはプロダクト開発の進行に合わせて拡張する。

## ルール

- **秘密情報を `.env.example` に書かない**: キー名のみ記載し、値はコメントでフォーマットを示す
- **新しい環境変数を追加したら `.env.example` も更新する**
- **CI/CD のシークレットは GitHub Secrets で管理する**

## PostgreSQL 接続

ローカル DB は DevContainer の compose（`.devcontainer/docker-compose.yml`）に定義された `db` サービス（PostgreSQL 18）を使う。配置の意思決定は [ADR-0016](../adr/0016-devcontainer-integration.md) を参照。

### `DATABASE_URL` の構成

```text
postgresql://<POSTGRES_USER>:<POSTGRES_PASSWORD>@<host>:<port>/<POSTGRES_DB>
```

| 接続元 | host | port |
| ------ | ---- | ---- |
| DevContainer 内（既定） | `db`（compose のサービス名） | `5432`（コンテナ内 listen ポート、固定） |
| ホストから直接 | `localhost` | `.devcontainer/.env` の `DB_PORT`（既定 `5432`） |

`.env.example` には DevContainer 内向けの既定値が入っている。ホストから接続する場合はコメント側の値に置き換える。`.devcontainer/.env` の `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` を変更した場合は `.env` の `DATABASE_URL` も合わせて更新する。

### 起動・停止・リセット

VS Code「Dev Containers: Reopen in Container」で開いている場合は VS Code 側のライフサイクルに従う。CLI から操作する場合は以下：

```bash
# 起動（db サービスのみ）
docker compose -f .devcontainer/docker-compose.yml up -d db

# 状態確認（healthcheck の状況）
docker compose -f .devcontainer/docker-compose.yml ps

# 停止（コンテナのみ削除、データは残る）
docker compose -f .devcontainer/docker-compose.yml down

# リセット（named volume を削除してデータを破棄）
docker compose -f .devcontainer/docker-compose.yml down
docker volume rm agent-team-studio-pgdata-main
```

worktree 単位で DB を分離する場合の `DB_VOLUME` 切替や、DevContainer 全体の運用詳細は [devcontainer.md](./devcontainer.md) を参照。
