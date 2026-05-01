# 環境変数・シークレット管理ガイド

env のファイル運用・命名規約・取り扱いルールを扱う。具体的なコピー手順や DB 接続構造は別ガイドに分離している（[関連](#関連)節を参照）。

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
| `POSTGRES_` | PostgreSQL 公式 image の予約変数（プロジェクト規約外、image 仕様のためそのまま使用） | `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` |

プレフィックスはプロダクト開発の進行に合わせて拡張する。

## ルール

- **本番シークレットを `.env.example` に書かない**: API キー・本番 DB 認証情報・OAuth secret 等は、キー名のみ記載し、値はコメントでフォーマットを示す
  - 例外: ローカル開発専用のデフォルト値（`POSTGRES_PASSWORD=postgres` 等）は実値を記載してよい（[ADR-0017](../adr/0017-relocate-compose-and-consolidate-env.md)）。compose ファイル自体には書き込まず `.env` 経由で注入することで、本番では別の値で安全に上書きできる
- **新しい環境変数を追加したら `.env.example` も更新する**
- **CI/CD のシークレットは GitHub Secrets で管理する**
- **DB 接続文字列をアプリで組み立てない**: container 内では `process.env.DATABASE_URL` のみ参照する。組み立ての責務は compose が持つ（詳細は [devcontainer.md の DB 接続の構造](./devcontainer.md#db-接続の構造)）

## 関連

- 初回セットアップ（`.env` のコピーと DevContainer 起動） → [devcontainer.md の 初回セットアップ](./devcontainer.md#初回セットアップ)
- split モード（worktree 並行）での `.env` 設定 → [worktree.md の split モード](./worktree.md)
- DB の部品方式・接続元別 host/port → [devcontainer.md の DB 接続の構造](./devcontainer.md#db-接続の構造)
