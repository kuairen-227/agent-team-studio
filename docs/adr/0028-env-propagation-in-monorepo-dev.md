# 0028. モノレポ開発時の env 伝播方針（per-package `--env-file`）

## Status

accepted

- 作成日: 2026-05-09
- 関連: ADR-0018（ルート `.env` SSoT）, Issue #142

## Context

ADR-0018 でルート `.env` を SSoT に決定した後、`bun run dev` で `apps/api` が起動クラッシュすることを発見した（Issue #142）。

`packages/agent-core/src/llm-client.ts` はモジュールロード時に `LLM_API_KEY` を検証して throw する。`bun run dev`（= `turbo run dev`）では以下の理由で `LLM_API_KEY` が届かない：

- `turbo run dev` は各パッケージの dev script を **パッケージディレクトリを CWD** として起動する
- Bun の `.env` auto-load は CWD 基準のため `apps/api/.env`（存在しない）を探す
- 親シェルにも `LLM_API_KEY` は export されていない
- Turborepo の `env[]` 配列はキャッシュ整合性のためであり、ランタイム注入はしない

## Considered Alternatives

| 案 | 判定 | 理由 |
| -- | ---- | ---- |
| ルート `bun --env-file .env run _dev` ラッパー | 却下 | Turbo が全パッケージに env を継承するため `apps/web` など本来必要のないパッケージにも `LLM_API_KEY` が混入し、本番の env 分離を再現できない |
| `docker-compose.yml` の `environment:` に `LLM_API_KEY` を追加 | 却下 | compose 起動が必須になり、compose なし（ホスト Bun 直接）で `bun run dev` できなくなる |
| `devcontainer.json` の `remoteEnv` / `containerEnv` | 却下 | ホスト側での `export LLM_API_KEY=...` が前提。ルート `.env` SSoT 方針と相性が悪く、`.env` コピーだけでセットアップが完了しない |
| `direnv` の DevContainer 導入 | 却下 | ツール追加とユーザー側 setup が必要 |
| シェルプロファイルへの自動 source | 却下 | bash 依存・特殊文字で破綻するリスク・コンテナ外で機能しない |
| `dotenv-cli` ラッパー | 却下 | Bun の `--env-file` と同等の機能のために外部依存を追加するのは YAGNI |
| **per-package `--env-file ../../.env`** | **採用** | 各パッケージが必要な env var だけを明示的にロードし、本番の env 分離を再現できる。Bun ネイティブ機能・依存追加なし・`cd apps/api && bun run dev` の個別起動にも対応 |

## Decision

`apps/api/package.json` の dev script を以下に変更する：

```json
"dev": "bun --env-file ../../.env --watch src/index.ts"
```

合わせて `turbo.json` を更新する：

- dev タスクの `env` 配列に `LLM_API_KEY`、`LLM_BASE_URL` を追加（キャッシュ整合性）

**フロントエンド（`apps/web`）の扱い：**

`apps/web` の dev script は `--env-file` を付けない。`LLM_API_KEY` は API サーバー専用であり、フロントエンドに混入させない。将来 `VITE_*` 変数が必要になった場合は `vite.config.ts` の `envDir` 設定で対応する。

## Consequences

- `bun run dev`（ルート）・`cd apps/api && bun run dev`（個別）どちらでも `LLM_API_KEY` が届く
- `apps/web` は `LLM_API_KEY` を受け取らない（本番と同じ env 分離）
- 新しい app を追加するとき、dev script に `--env-file ../../.env` を付けるか否かを意識的に判断する必要がある
- `apps/*` と `packages/*` はすべて monorepo root から 2 階層であるため、相対パス `../../.env` は安定している。ただし構造が変わった場合は更新が必要
- ルート `.env` が存在しない場合、`bun --env-file` はクラッシュせず無視する（開発環境を壊さない）
