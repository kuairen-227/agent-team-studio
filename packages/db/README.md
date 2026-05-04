# @agent-team-studio/db

MVP のデータ永続化レイヤー。Drizzle ORM + PostgreSQL（[ADR-0008](../../docs/adr/0008-tech-stack.md)）。

論理モデルの SSoT は [docs/design/data-model.md](../../docs/design/data-model.md)。本 README は **物理スキーマ規約**（命名・ID 形式・制約・テスト戦略）の SSoT。

## ディレクトリ構成

```text
packages/db/
├── drizzle.config.ts          # drizzle-kit 設定
├── drizzle/migrations/        # 生成される migration SQL（手動編集しない）
└── src/
    ├── schema/                # 物理スキーマ（テーブル定義）
    │   ├── templates.ts
    │   ├── executions.ts
    │   ├── agent-executions.ts
    │   ├── results.ts
    │   └── index.ts
    ├── repositories/          # データアクセス関数（[ADR-0023](../../docs/adr/0023-repository-layer-placement.md)）
    │   └── templates.ts
    ├── seed-data/             # シード用データ定義
    │   └── competitor-analysis.ts
    ├── client.ts              # DbClient ファクトリ
    ├── migrate.ts             # `bun run db:migrate` の実体
    ├── seed.ts                # `bun run db:seed` の実体
    └── index.ts               # パッケージエントリ
```

## コマンド

ルートで実行する（turbo 経由）:

| コマンド | 用途 |
| --- | --- |
| `bun run db:generate` | schema 差分から migration SQL を生成 |
| `bun run db:migrate` | 生成済み SQL を `DATABASE_URL` の DB に適用 |
| `bun run db:seed` | 競合調査テンプレートを投入（冪等） |

`DATABASE_URL` は compose の env 経由で注入される（[ADR-0018](../../docs/adr/0018-relocate-compose-and-consolidate-env.md)）。turbo 側で `env: ["DATABASE_URL"]` を明示しているので、env を変えると task キャッシュが正しく無効化される（本タスクは `cache: false` だが将来の保険）。

## 物理スキーマ規約

### ID 形式

- **UUID v7**（PostgreSQL 18 ネイティブの `uuidv7()` で DB 側生成）
- 全テーブルで `id uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL`
- 採用理由: ① RFC 9562 標準 ② 時系列ソート可能（先頭 48bit が ms タイムスタンプ） ③ PG 18 でネイティブ関数として標準化済み
- アプリ側生成は不要（DB に任せる）

### カラム命名

- DB カラム: `snake_case`（`created_at`, `template_id` など）
- TS フィールド: `camelCase`（Drizzle が自動マッピング、`drizzle.config.ts` で `casing: "snake_case"` を有効化）
- domain-types.ts の論理モデルは `snake_case`（[data-model.md §6](../../docs/design/data-model.md) と整合）。Drizzle の `$inferSelect` は camelCase に変換されるため、repo 層での明示マッピングは不要

### enum の表現

- **`text` カラム + `CHECK` 制約** で表現（PG enum 型は使わない）
- 採用理由: 値追加・削除が `ALTER TABLE ... ADD/DROP CONSTRAINT` で済むため、MVP の変動期に強い
- TS 側型安全は Drizzle の `text("col", { enum: [...] })` で確保
- DB 側防護壁は `pgTable` の third arg で `check()` を明示（二重）

### timestamp

- 全 timestamp は `timestamp with time zone`（`timestamptz`）
- DB 既定値は `defaultNow()`（PG 側 `now()` で生成。アプリ起動時刻に依存しない）

### FK ポリシー

| 関係 | onDelete | 理由 |
| --- | --- | --- |
| `executions.template_id` → `templates.id` | `RESTRICT` | テンプレ消失で過去実行が宙吊りにならないよう保護 |
| `agent_executions.execution_id` → `executions.id` | `CASCADE` | 親 Execution 削除時に追従（独立保持の必要なし） |
| `results.execution_id` → `executions.id` | `CASCADE` | 同上 |

### UNIQUE 制約

| 制約 | 施行場所 | 由来 |
| --- | --- | --- |
| `(execution_id, agent_id)` UNIQUE on `agent_executions` | DB UNIQUE INDEX | [data-model.md §3](../../docs/design/data-model.md) 不変条件「同一 Execution 内で agent_id は一意」 |
| `(execution_id)` UNIQUE on `results` | DB UNIQUE INDEX | [data-model.md §2](../../docs/design/data-model.md) `Execution : Result = 1 : 0..1` |

### JSON カラム

- 全構造化属性は `jsonb`（`json` ではない。PG ネイティブの構造化検索とインデックスを活かすため）
- Drizzle の `.$type<T>()` で TS 型を伝搬。ランタイムバリデーションは別途必要（書き込み時に zod 等を検討）

## seed データ

`bun run db:seed` で競合調査テンプレートを 1 件投入する。

- 名前 `競合調査` で既存チェック → 既存ならスキップ（冪等）
- 投入内容の SSoT: `src/seed-data/competitor-analysis.ts`
  - `input_schema`: [docs/design/templates/competitor-analysis.md](../../docs/design/templates/competitor-analysis.md)
  - `system_prompt_template`: [docs/product/templates/competitor-analysis.md](../../docs/product/templates/competitor-analysis.md)
  - `LlmDefaults`: [docs/design/llm-integration.md](../../docs/design/llm-integration.md)
  - `agent_id`: A4（[Issue #53](https://github.com/kuairen-227/agent-team-studio/issues/53)）で命名規約確定後に更新

## テスト用 DB 戦略

MVP は **truncate-per-test** を採用する。

- 各テストの `beforeEach` で全テーブルを `TRUNCATE ... CASCADE`
- 並列実行は当面想定しない（テスト数が少ないうち）
- 設定は最小限。テストフィクスチャ配置方針は Walking Skeleton（[Issue #82](https://github.com/kuairen-227/agent-team-studio/issues/82)）の R1 で `docs/guides/development-workflow.md` に追記

将来の拡張パス（必要になった時点で切替）:

| 戦略 | 移行条件 |
| --- | --- |
| transaction rollback | テストごとの実行時間を更に圧縮したくなった |
| schema 分離 | テスト並列化が必要（テスト本数が数百を超える） |
| testcontainers | production-like 検証が必要 |

## 後続 Issue で確定する事項

| 項目 | 確定先 |
| --- | --- |
| `agent_id` 命名規約の最終形 | [Issue #53](https://github.com/kuairen-227/agent-team-studio/issues/53)（A4） |
| LLM クライアント差し替え方針 | 最初の agent-core Issue |
| `Result.structured` フィールド名の最終確認 | 実装で違和感が出たタイミングで再検討 |

## 関連

- [ADR-0008](../../docs/adr/0008-tech-stack.md) 技術スタック
- [ADR-0009](../../docs/adr/0009-architecture.md) アーキテクチャ
- [ADR-0023](../../docs/adr/0023-repository-layer-placement.md) repo 層の物理配置（packages/db 採用）
- [ADR-0014](../../docs/adr/0014-mvp-data-model-design.md) MVP データモデル設計方針
- [docs/design/data-model.md](../../docs/design/data-model.md) 論理モデル SSoT
