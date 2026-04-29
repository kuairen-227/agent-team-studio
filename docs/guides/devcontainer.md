# DevContainer 運用ガイド

AI 駆動開発（Claude Code）と PostgreSQL を統合した DevContainer の利用手順。

意思決定の背景は [ADR-0016](../adr/0016-devcontainer-integration.md) を参照。worktree との使い分けは [worktree.md](./worktree.md) を参照。

## 構成

`.devcontainer/` 配下のファイル構成：

```text
.devcontainer/
├── devcontainer.json    # VS Code Dev Containers の設定
├── docker-compose.yml   # app + db のサービス定義
└── .env.example         # worktree ごとに上書きする値のテンプレート
```

サービス：

| サービス | 用途 | 既定ポート |
| --- | --- | --- |
| `app` | 開発用コンテナ（bun, gh, claude-code を features で導入） | 3000 |
| `db` | PostgreSQL 18（healthcheck 付き） | 5432 |

永続化される named volume：

| 名前 | 用途 |
| --- | --- |
| `claude-auth` | Claude Code の認証情報。全 DevContainer で共有 |
| `pgdata-<name>` | PostgreSQL のデータ。`DB_VOLUME` で worktree ごとに切替可 |

## 初回セットアップ

```bash
# .devcontainer/.env を作成
cp .devcontainer/.env.example .devcontainer/.env

# ルートの .env を作成（DATABASE_URL 等）
cp .env.example .env
```

VS Code でリポジトリを開き、コマンドパレットから「Dev Containers: Reopen in Container」を実行する。初回は compose のイメージ取得とボリューム作成で数分かかる。

コンテナ内でターミナルを開き、Claude Code に初回ログインする：

```bash
claude login
```

認証情報は `claude-auth` volume に書き込まれ、以後すべての DevContainer（worktree 含む）で共有される。

## 認証情報の共有

Claude Code の認証は `claude-auth` という named volume にマウントされた `/home/node/.claude` で永続化される。OS 非依存で、worktree ごとに DevContainer を起動し直しても再ログインは不要。

トークンが期限切れになった場合：

```bash
# どれか1つの DevContainer で
claude logout
claude login
# → claude-auth volume が更新され、全コンテナに反映
```

認証を完全リセットしたい場合：

```bash
docker volume rm claude-auth
# 次回 claude login から再開
```

## DB のモード切替

`.devcontainer/.env` の `DB_VOLUME` で PostgreSQL の named volume を選択する。

### 共有モード（既定）

複数の worktree で同じ DB を参照する。読取中心や軽微な変更のときに使う。

```bash
# .devcontainer/.env
DB_VOLUME=pgdata-main
```

> nested で DB スキーマを変更する場合は main DB を汚さないように `search_path` を worktree 名で切るか `CREATE DATABASE wt_<name>` で別 DB を作ること。詳細は [worktree.md](./worktree.md) のカテゴリ C を参照。

### 隔離モード

worktree ごとに独立した DB を起動する。破壊的スキーマ変更・マイグレーション rollback 検証・大規模 seed の試行に使う。

```bash
# 例: feat-auth worktree 内で
DB_VOLUME=pgdata-feat-auth
DB_PORT=5442
```

worktree のライフサイクル: `git worktree remove` する **前に** `docker volume rm <DB_VOLUME>` を実行して volume を削除する。残したまま worktree を消すと孤立 volume が増殖する。

```bash
# ホスト側ターミナルで、畳む worktree ディレクトリから実行
# （リポジトリルートから実行すると compose プロジェクト名が main を指してしまう）
cd ../agent-team-studio--feat-auth
docker compose -f .devcontainer/docker-compose.yml down
docker volume rm pgdata-feat-auth
cd -
git worktree remove ../agent-team-studio--feat-auth
# 未コミット変更がある場合は git -C ../agent-team-studio--feat-auth stash してから実行するか、
# 残しても問題なければ git worktree remove --force ... で強制削除する
```

## ポート割当

worktree を並行起動する場合、ホスト側のポート衝突を避けるために `.devcontainer/.env` でオフセットする。命名規約は **+10 オフセット**：

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

`devcontainer.json` の `forwardPorts: [3000, 5432]` は **solo モード向けの定義**。split モードで `APP_PORT=3010` / `DB_PORT=5442` などに変更しても自動追従しないが、compose の `ports` がホストレベルでポートをバインドするため VS Code の `forwardPorts` とは独立して機能し実害はない（VS Code のポート転送 UI に main の値が見えるだけ）。

## Playwright の利用

Playwright を AI ワークフローで動かすときは、`.devcontainer/.env` のポート設定をそのまま `playwright.config.ts` の dev server に渡す。詳細な使い分け（軽量 / 視覚デバッグ / 並行 E2E）は [worktree.md](./worktree.md) のユースケースマトリクスを参照。

ブラウザの依存パッケージは Playwright の正式導入時（後続 Issue）に DevContainer の features またはイメージに追加する。本 ADR-0016 のスコープでは導入しない。

## トラブルシューティング

| 症状 | 対処 |
| --- | --- |
| ポートが衝突する | `.devcontainer/.env` の `APP_PORT` / `DB_PORT` をオフセットする |
| DB に接続できない | `docker compose -f .devcontainer/docker-compose.yml ps` で `db` の healthcheck 状態を確認 |
| 認証が切れた | `claude logout && claude login` で `claude-auth` volume を更新 |
| DB を初期化したい | `docker volume rm <DB_VOLUME>` してから DevContainer を再起動 |
| コンテナを作り直したい | VS Code コマンドパレットから「Dev Containers: Rebuild Container」を実行 |
| worktree が増えてリソース不足 | 使わない DevContainer は `docker compose stop` で休眠（削除はしない） |

> ⚠️ **`docker compose down -v` の注意**: `-v` オプションは compose ファイルで宣言した named volume（`claude-auth` と `pgdata-<name>` の両方）を削除する。誤って実行すると認証情報が消えて全 DevContainer で再ログインが必要になり、DB データも失われる。`claude-auth` を残したい場合は `docker volume rm pgdata-<name>` で個別に削除する。
