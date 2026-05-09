# 0028. env を DevContainer 変数とアプリ変数に分割し Vite proxy を可変化する

## Status

accepted

- 作成日: 2026-05-09
- 関連: ADR-0018（ルート `.env` SSoT）, Issue #142

## Context

ADR-0018 でルート `.env` を SSoT に決定したが、compose 用 DevContainer 変数（`APP_PORT`, `DB_PORT` 等）と API アプリ固有変数（`LLM_API_KEY`, `LLM_BASE_URL`）が 1 ファイルに混在していた。

`apps/api` の dev script は `bun --watch src/index.ts` でプロセス環境変数をそのまま参照するため、compose が inject する変数に頼るか、ルート `.env` を手動で source する必要があった。どちらの方法も関心の分離が不明確でセキュリティ上の懸念がある（DevContainer 変数が API プロセスに全量届く）。

また `apps/web/vite.config.ts` の proxy target が `localhost:3000` に固定されており、nested モード（同一コンテナ内並行 dev）での API ポート変更に対応できなかった。

## Considered Alternatives

**1. ルート `.env` に全変数を集約したまま `--env-file ../../.env` で API に届ける**

- シンプルだが、DevContainer 変数（`APP_PORT`, `DB_PORT` 等）が API プロセスに全量届く。関心の分離がない。

**2. compose の `environment:` に `LLM_API_KEY` を追加して API コンテナに inject する**

- compose が管理するため一元化できるが、`LLM_API_KEY` がコンテナ外（ホスト）に漏れず、worktree 単位での切替が compose の再起動を伴う。

**3. アプリ変数を各 app の `.env` に分離する（採用）**

- DevContainer 変数と API アプリ変数を完全分離。worktree 単位で `apps/api/.env` を差し替えるだけで LLM エンドポイントを切替可能。

## Decision

env ファイルを以下のように分割する。

| ファイル | 変数カテゴリ | 読み込み方 |
| --- | --- | --- |
| ルート `.env` | DevContainer 変数（`APP_PORT`, `DB_PORT`, `POSTGRES_*`, `DB_VOLUME`, `WORKTREE_ID`） | compose が自動読み込み |
| `apps/api/.env` | API アプリ変数（`LLM_API_KEY`, `LLM_BASE_URL`, `PORT`） | `bun --env-file .env` |
| `apps/web/.env` | Web アプリ変数（`API_PORT`, `WEB_PORT`） | Vite `loadEnv` |

あわせて `apps/web/vite.config.ts` を `defineConfig` 関数スタイルに変更し、`loadEnv` で `API_PORT`（proxy target）と `WEB_PORT`（Vite listen port）を読み込む。

`docker-compose.yml` は変更しない（`LLM_API_KEY` を compose から inject していないため影響なし）。

## Consequences

- API プロセスが DevContainer 変数（`APP_PORT` 等）を受け取らなくなり、関心が分離される
- 初回セットアップ手順が 3 ファイルのコピーに増える（`.env`, `apps/api/.env`, `apps/web/.env`）
- nested 並行 dev では `apps/api/.env` の `PORT` と `apps/web/.env` の `API_PORT` / `WEB_PORT` を main と異なる値に設定する必要がある
- split モード（別コンテナ）では `API_PORT` / `WEB_PORT` を変更する必要はない（コンテナ内部ポートは常に 3000 / 5173）
- `.worktreeinclude` に `apps/api/.env` と `apps/web/.env` を追加することで nested worktree 作成時に自動コピーされる
