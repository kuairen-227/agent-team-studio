# 環境変数・シークレット管理ガイド

## セットアップ

```bash
cp .env.example .env
```

`.env` に実際の値を設定する。`.env` は `.gitignore` に含まれ、リポジトリには追跡されない。

## ファイルの使い分け

| ファイル | 用途 | Git 追跡 |
| ---------- | ------ | ---------- |
| `.env.example` | テンプレート（キー名 + 開発環境のデフォルト値） | する |
| `.env` | ローカル開発用の実際の値（compose が自動読み込み） | しない |
| `.env.local` | 個人設定の上書き | しない |

`.env` はリポジトリルートの 1 ファイルに集約する（[ADR-0017](../adr/0017-relocate-compose-and-consolidate-env.md)）。`docker-compose.yml` と同じディレクトリにあるため、compose は `.env` を **自動で variable interpolation の解決元** として読み込む。

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

ローカル DB は `docker-compose.yml` に定義された `db` サービス（PostgreSQL 18）を使う。配置・env 構造の意思決定は [ADR-0016](../adr/0016-devcontainer-integration.md) と [ADR-0017](../adr/0017-relocate-compose-and-consolidate-env.md) を参照。

### 部品方式

`.env` には **DB の部品（接続情報の素材）** だけを置き、`DATABASE_URL` は `docker-compose.yml` の `environment:` で組み立てて app コンテナに注入する。

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

これにより app と db が常に同じ部品から派生するため不整合が起きない。

### アプリ実装側のルール

container 内では `process.env.DATABASE_URL` のみ参照すること。`POSTGRES_USER` 等の部品も `.env` から読めてしまうが、**接続文字列を組み立てる責務は compose が持つ**。アプリ側で組み立てると compose の単一定義から外れて二重管理になる。

### 接続元別の host / port

| 接続元 | host | port |
| ------ | ---- | ---- |
| container 内（既定） | `db`（compose のサービス名） | `5432`（コンテナ内 listen ポート、固定） |
| ホストから直接（psql 等） | `localhost` | `.env` の `DB_PORT`（既定 `5432`） |

ホストから直接接続する場合は、`.env` の部品を組み立てて `psql` の引数に渡すか、必要に応じて手動で `DATABASE_URL` 環境変数を export する。

### 起動・停止・リセット

DB の起動・停止・リセット手順、worktree 単位の `DB_VOLUME` 切替などの運用は [devcontainer.md](./devcontainer.md) を参照。
