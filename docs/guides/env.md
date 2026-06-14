# 環境変数・シークレット管理ガイド

env のファイル運用・命名規約・取り扱いルールを扱う。具体的なコピー手順や DB 接続構造は別ガイドに分離している（[関連](#関連)節を参照）。

## ファイルの使い分け

| ファイル | 用途 | Git 追跡 |
| ---------- | ------ | ---------- |
| `.env.example` | DevContainer 変数テンプレート（compose 用） | する |
| `.env` | ローカル開発用の実際の値（compose が自動読み込み） | しない |
| `.env.local` | 個人設定の上書き | しない |
| `apps/api/.env.example` | API アプリ変数テンプレート（`LLM_API_KEY` 等） | する |
| `apps/api/.env` | API アプリ変数の実際の値（`bun --env-file .env` で読み込み） | しない |
| `apps/web/.env.example` | Web アプリ変数テンプレート（`API_PORT` / `WEB_PORT` 等） | する |
| `apps/web/.env` | Web アプリ変数の実際の値（Vite `loadEnv` で読み込み） | しない |

ルート `.env` は compose/DevContainer 変数専用（[ADR-0018](../adr/0018-relocate-compose-and-consolidate-env.md)）。compose は同ディレクトリの `.env` を variable interpolation の解決元として自動読み込みする。アプリ固有変数は各 app の `.env` に分離し、DevContainer 変数との混在を避ける（[ADR-0028](../adr/0028-split-env-infra-and-app.md)）。

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

## ルール

- **本番シークレットを `.env.example` に書かない**: API キー・本番 DB 認証情報・OAuth secret 等は、キー名のみ記載し、値はコメントでフォーマットを示す
  - 例外: ローカル開発専用のデフォルト値（`POSTGRES_PASSWORD=postgres` 等）は実値を記載してよい（[ADR-0018](../adr/0018-relocate-compose-and-consolidate-env.md)）。compose ファイル自体には書き込まず `.env` 経由で注入することで、本番では別の値で安全に上書きできる
- **新しい環境変数を追加したら対応する `.env.example` も更新する**（DevContainer 変数はルート、アプリ変数は各 app）
- **CI/CD のシークレットは GitHub Secrets で管理する**
- **DB 接続文字列をアプリで組み立てない**: container 内では `process.env.DATABASE_URL` のみ参照する。組み立ての責務は compose が持つ（詳細は [devcontainer.md の DB 接続の構造](./devcontainer.md#db-接続の構造)）

## Claude Code からのシークレット保護

AI エージェント（Claude Code）が `.env` 系の値を読み取る・環境変数をダンプする経路を多層で遮断する（[ADR-0039](../adr/0039-secret-read-guard.md)。前提分担は [ADR-0037](../adr/0037-ai-execution-sandbox-policy.md)）。

- **`permissions.deny`（Read 層）**: `.env` / `.env.local` / `.env.*.local` / `.env.keys` / `.env.production` 等の実シークレットファイルを deny する。`.env.example` / `.env.sample` はテンプレート（秘密なし）のため deny に含めず可読を維持する
- **PreToolUse ガードフック（Bash 層）**: `.claude/hooks/guard-secret-access.sh` が、`source .env` / `printenv` / `env` / `bun -e ...readFileSync(".env")` / `/proc/*/environ` 等、deny がカバーしないサブプロセス経路をコマンド文字列検査でブロックする
- 補足: アプリ起動は `bun run dev`（Turborepo 経由）や compose を使い、`.env` をシェルに展開しない経路を標準とする。`bun --env-file .env` 等の明示参照はガードによりブロックされる
- **新しいシークレットファイルを追加したら**、`.claude/settings.json` の `permissions.deny` と `.claude/hooks/guard-secret-access.sh` の検知対象に含まれるか確認する。判断基準: `.env` プレフィックスを持つ名前（`.env.staging` 等）は既存パターンが自動でカバーする。`secrets.yaml` / `credentials.json` 等それ以外の命名は **deny とガードフックの両方に手動で追加**する。ガードの挙動は `.claude/hooks/guard-secret-access.test.sh` で検証する

### 平文 `.env` の排除（dotenvx・予定）

読取を塞いでも平文 `.env` がディスクにある限り露出面が残る。これを解消するため **dotenvx**（無料・OSS・ローカル完結）で暗号化 at-rest を採用する方向とする（[ADR-0039](../adr/0039-secret-read-guard.md) 論点 2）。実シークレットを持つローカルでの作業のため、導入時の runbook:

1. `dotenvx encrypt`（または `dotenvx set KEY value`）で `.env` を暗号化。公開鍵が `.env` 先頭に、秘密鍵が `.env.keys` に書き出される
2. `.env.keys` は **Git 追跡しない**（`.gitignore` の `**/.env.*` で既に無視。バックアップは安全な場所へ）。`.env.keys` は permissions deny ＋ ガードフックの保護対象
3. 起動は `dotenvx run -- <command>` で実行時のみ復号注入する。docker-compose 連携は `DOTENV_PRIVATE_KEY` を渡す方式を導入時に確定する
4. 注意: 本リポジトリは `**/.env` を `.gitignore` で無視するため、dotenvx の「暗号化済み `.env` を commit する」モデルとの整合（ファイル名 / ignore 方針）は導入時に判断する

## 関連

- 初回セットアップ（`.env` のコピーと DevContainer 起動） → [devcontainer.md の 初回セットアップ](./devcontainer.md#初回セットアップ)
- split モード（worktree 並行）での `.env` 設定 → [worktree.md の split モード](./worktree.md)
- DB の部品方式・接続元別 host/port → [devcontainer.md の DB 接続の構造](./devcontainer.md#db-接続の構造)
