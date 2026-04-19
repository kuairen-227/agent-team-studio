# 0008. 技術スタック

## Status

accepted

- 作成日: 2026-04-17
- 関連: ADR-0003（前提）, ADR-0005（前提）, Issue #10

## Context

ADR-0005 で MVP スコープ（競合調査の並列深掘り）が確定し、技術要件が明らかになった：

- Web UI（テンプレート選択・リアルタイム進捗・結果表示）
- WebSocket によるエージェント実行状況のリアルタイム通信
- 複数エージェントの並列実行基盤
- LLM API 連携（プロバイダ・SDK の選定は本 ADR のスコープ外。別途決定する）
- 実行履歴・テンプレートの永続化
- シングルユーザー前提（認証不要）

MVP の技術特性を分析すると、リアルタイム・クライアント中心のアプリケーションであり、SSR/SSG が活きる場面がほぼない（SEO 不要、シングルユーザー、主要画面が WebSocket ストリーミング）。この特性がフロントエンド選定に大きく影響する。

## Considered Alternatives

### ランタイム

| # | 選択肢 | 判定 |
| - | --- | --- |
| A | Bun | **採用** — TypeScript ネイティブ実行、組み込みテストランナー・パッケージ管理。ツールチェーンが大幅に簡素化される（tsx, vitest が不要）。Hono・Vite・Drizzle すべて対応済み。Node.js 互換 API が充実し実用段階 |
| B | Node.js 24 | 却下 — 最も成熟したエコシステムだが、TS 実行に tsx、テストに vitest 等の追加ツールが必要でツールチェーンが多い |
| C | Deno 2 | 却下 — Web Standard API ベースで Hono との親和性は最高だが、React + Vite エコシステムとの統合実績が Bun に劣る |

### モノレポ構成

| # | 選択肢 | 判定 |
| - | --- | --- |
| A | Bun workspace + Turborepo | **採用** — Bun 組み込みの workspace 機能を活用し、Turborepo でビルドキャッシュ・タスクオーケストレーションを効率化 |
| B | Bun workspace のみ（Turborepo なし） | 却下 — パッケージ間のビルド順序やキャッシュを手動管理する負担が大きい |
| C | Nx | 却下 — 機能は豊富だが設定が重く、MVP 規模ではオーバースペック |

### フロントエンド

| # | 選択肢 | 判定 |
| - | --- | --- |
| A | React + Vite (SPA) | **採用** — MVP のリアルタイム中心の特性に最も素直な構成。Hono と同一サーバーで配信でき、WebSocket 統合が自然。CORS 設定不要。フレームワークの魔法に頼らず Web の基礎が学べる |
| B | Next.js (App Router) | 却下 — RSC・Server Actions の学習価値は高いが、MVP の技術特性（リアルタイム中心・SEO 不要・シングルユーザー）では強みが活きない。Hono と 2 サーバー構成になり、CORS・起動管理が複雑化する |
| C | Remix | 却下 — Web 標準準拠で設計は優れるがエコシステムが小さく、リアルタイム表示主体の本 MVP では強みが活きにくい |

### バックエンド API

| # | 選択肢 | 判定 |
| - | --- | --- |
| A | Hono | **採用** — Web Standard API ベース、TypeScript ファースト、型安全なルーティング。軽量かつ組み込み WebSocket サポートあり。Bun との相性が特に良好。SPA の静的ファイル配信も可能で、1 サーバー構成を実現できる |
| B | Fastify | 却下 — 成熟したエコシステムだが、Hono に比べ設定が重く、Web Standard API ベースではない |
| C | Express v5 | 却下 — 型サポートが弱く TypeScript strict との相性がやや劣る |

### データベース

| # | 選択肢 | 判定 |
| - | --- | --- |
| A | PostgreSQL + Drizzle ORM | **採用** — 本格的な RDBMS の経験を積める。Drizzle は TypeScript ファーストの軽量 ORM でスキーマ定義が直感的。JSON 型・全文検索など将来の拡張にも対応可能 |
| B | SQLite + Drizzle ORM | 却下 — 外部サービス不要で手軽だが、学習目的として PostgreSQL の経験を優先。Drizzle 経由なので将来の移行は容易 |
| C | PostgreSQL + Prisma | 却下 — 人気は高いが生成コード量が多く起動が重い。Drizzle の方が軽量で TypeScript との一体感が強い |

### UI コンポーネント

| # | 選択肢 | 判定 |
| - | --- | --- |
| A | shadcn/ui + Tailwind CSS | **採用** — コンポーネントをプロジェクトにコピーして使う方式でカスタマイズ自由度が高い。Radix UI ベースでアクセシビリティ確保。React エコシステムで最も主流 |
| B | Mantine | 却下 — 高品質だがライブラリの API に縛られやすい |
| C | Headless UI + Tailwind CSS | 却下 — 自由度は最大だが UI 構築の手間が大きく MVP スピードに不向き |

### Lint / Format

| # | 選択肢 | 判定 |
| - | --- | --- |
| A | Biome | **採用** — ESLint + Prettier を 1 ツールに統合。Rust 製で高速、設定が少ない |
| B | ESLint + Prettier | 却下 — 実績は豊富だが 2 ツールの設定・競合管理が煩雑。Biome で統合できる |

### リアルタイム通信

| # | 選択肢 | 判定 |
| - | --- | --- |
| A | Hono 組み込み WebSocket | **採用** — バックエンドと統一的なミドルウェア体系で扱える。SPA と同一サーバーなので接続がシンプル。MVP のスコープ（エージェント単位のステータス + ストリーミング表示）には十分 |
| B | Socket.IO | 却下 — 高レベル機能は豊富だが抽象度が高く、WebSocket の理解が深まらない |
| C | ws（生 WebSocket） | 却下 — 低レベルすぎて MVP のスピードに不向き |

## Decision

### 技術スタック一覧

| レイヤー | 技術 | バージョン方針 |
| --- | --- | --- |
| ランタイム | Bun | 最新安定版 |
| 言語 | TypeScript (strict) | 最新安定版 |
| パッケージ管理 | Bun (組み込み) | ランタイムに同梱 |
| テストランナー | bun:test (組み込み) | ランタイムに同梱 |
| モノレポ | Turborepo | 最新安定版 |
| フロントエンド | React + Vite (SPA) | 最新安定版 |
| UI コンポーネント | shadcn/ui + Tailwind CSS v4 | 最新安定版 |
| バックエンド | Hono | 最新安定版 |
| WebSocket | Hono 組み込み WebSocket | Hono に同梱 |
| データベース | PostgreSQL | 最新安定版 |
| ORM | Drizzle ORM | 最新安定版 |
| Lint / Format | Biome | 最新安定版 |

### モノレポディレクトリ構成

```text
agent-team-studio/
├── apps/
│   ├── web/              # React + Vite (SPA)
│   └── api/              # Hono — API + WebSocket + SPA 配信
├── packages/
│   ├── shared/           # フロント・バックエンド共有の型定義
│   ├── agent-core/       # エージェント実行エンジン
│   └── db/               # Drizzle スキーマ・マイグレーション
├── package.json
├── tsconfig.base.json
├── biome.json
└── turbo.json
```

### パッケージ間の依存方向

```text
apps/web → packages/shared
apps/api → packages/shared, packages/agent-core, packages/db
packages/agent-core → packages/shared
packages/db → packages/shared
```

依存は常に apps → packages、packages → packages の一方向。循環依存は禁止する。

### React (SPA) + Hono の役割分担

- **React + Vite (apps/web)**: UI レンダリング、クライアントサイドの状態管理、WebSocket クライアント。ビルド成果物は静的ファイルとして Hono から配信される
- **Hono (apps/api)**: REST API、WebSocket サーバー、エージェント実行の制御、SPA の静的ファイル配信。ビジネスロジックとデータアクセスはすべて API サーバー経由

本番時は Hono が Vite のビルド成果物（静的ファイル）を配信するため、サーバーは 1 プロセスで完結する。開発時は Vite dev server と Hono dev server を並行起動し、Vite のプロキシ機能で API リクエストを Hono に転送する。

### 開発環境

devcontainer のベースイメージを Bun 対応に変更し、PostgreSQL コンテナを追加する。詳細は #12（CI/CD・開発環境）で定義する。

## Consequences

### ポジティブ

- Bun の採用により tsx, vitest 等の追加ツールが不要になり、ツールチェーンが簡素化される
- TypeScript ファーストのツールチェーン（Bun, Hono, Drizzle, Biome）で統一され、型安全性が高い
- React + Vite + Hono の 1 サーバー構成により、CORS 設定不要・デプロイがシンプル
- SPA 構成により WebSocket 統合が自然で、MVP のリアルタイム中心の特性に最も素直
- shadcn/ui により UI コンポーネントのカスタマイズ自由度が高く、ライブラリのバージョンロックインがない
- PostgreSQL + Drizzle により、本格的な RDBMS 運用を学びつつ型安全なデータアクセスが可能

### ネガティブ / リスク

- Bun は Node.js に比べエコシステムが若く、一部の npm パッケージで互換性問題が起きる可能性がある（Node.js 互換 API でほぼ解消されているが、完全ではない）
- SPA 構成のため、将来 SSR/SEO が必要になった場合はフレームワーク移行が必要（MVP ではシングルユーザー・社内ツールのため不要）
- PostgreSQL は devcontainer へのコンテナ追加が必要で、SQLite に比べ初期セットアップが重い
- Hono は急成長中だが Express に比べエコシステムが小さく、ニッチな問題の解決策が見つかりにくい場合がある
- Biome は ESLint ほどのプラグインエコシステムがなく、特殊なルール追加には制約がある
