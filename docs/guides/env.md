# 環境変数・シークレット管理ガイド

env のファイル運用・命名規約・取り扱いルールを扱う。具体的なコピー手順や DB 接続構造は別ガイドに分離している（[関連](#関連)節を参照）。

## ファイルの使い分け

| ファイル | 用途 | Git 追跡 |
| ---------- | ------ | ---------- |
| `.env.example` | テンプレート（キー名 + 開発環境のデフォルト値） | する |
| `.env` | ローカル開発用の実際の値（compose が自動読み込み） | しない |
| `.env.local` | 個人設定の上書き | しない |

`.env` はリポジトリルートの 1 ファイルに集約する（[ADR-0018](../adr/0018-relocate-compose-and-consolidate-env.md)）。`docker-compose.yml` と同じディレクトリにあるため、compose は `.env` を **自動で variable interpolation の解決元** として読み込む。

## 命名規約

- **UPPER_SNAKE_CASE** を使用する（例: `DATABASE_URL`）
- プレフィックスでカテゴリを示す

| プレフィックス | 用途 | 例 |
| ---------------- | ------ | ----- |
| `DATABASE_` | データベース接続 | `DATABASE_URL` |
| `LLM_` | LLM エンドポイント設定 | `LLM_API_KEY` / `LLM_BASE_URL` |
| `AUTH_` | 認証・認可 | `AUTH_SECRET` |
| `POSTGRES_` | PostgreSQL 公式 image の予約変数（プロジェクト規約外、image 仕様のためそのまま使用） | `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` |

プレフィックスはプロダクト開発の進行に合わせて拡張する。

## `bun run dev` における env 読み込みの仕組み

ローカル開発では各アプリが必要な env var を **`bun --env-file ../../.env`** で明示的に読み込む（[ADR-0028](../adr/0028-env-propagation-in-monorepo-dev.md)）。

```text
bun run dev（ルート）
 └─ turbo run dev
     ├─ apps/api: bun --env-file ../../.env --watch src/index.ts  ← .env を読む
     └─ apps/web: vite（--env-file なし）                         ← .env を読まない
```

**設計意図:**

- ルートで一括ロードしないことで、各アプリが本番と同じ env の分離状態を再現する
- `apps/web` は `VITE_` プレフィックス変数のみ必要で、それは Vite の `envDir` で別途管理する（将来拡張）
- 新しい app を追加するときは、その dev script に `--env-file ../../.env` を付けるかどうかを意識的に判断する

**`bun --env-file` の動作:**

- 指定ファイルを読み込んで process.env に設定する
- ルート `.env` が存在しない場合は無視される（クラッシュしない）
- 既に process.env に設定済みの変数は上書きされない（compose 注入値が優先）

## ルール

- **本番シークレットを `.env.example` に書かない**: API キー・本番 DB 認証情報・OAuth secret 等は、キー名のみ記載し、値はコメントでフォーマットを示す
  - 例外: ローカル開発専用のデフォルト値（`POSTGRES_PASSWORD=postgres` 等）は実値を記載してよい（[ADR-0018](../adr/0018-relocate-compose-and-consolidate-env.md)）。compose ファイル自体には書き込まず `.env` 経由で注入することで、本番では別の値で安全に上書きできる
- **新しい環境変数を追加したら `.env.example` も更新する**
- **CI/CD のシークレットは GitHub Secrets で管理する**
- **DB 接続文字列をアプリで組み立てない**: container 内では `process.env.DATABASE_URL` のみ参照する。組み立ての責務は compose が持つ（詳細は [devcontainer.md の DB 接続の構造](./devcontainer.md#db-接続の構造)）

## 関連

- 初回セットアップ（`.env` のコピーと DevContainer 起動） → [devcontainer.md の 初回セットアップ](./devcontainer.md#初回セットアップ)
- split モード（worktree 並行）での `.env` 設定 → [worktree.md の split モード](./worktree.md)
- DB の部品方式・接続元別 host/port → [devcontainer.md の DB 接続の構造](./devcontainer.md#db-接続の構造)
