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
- Claude API 連携
- 実行履歴・テンプレートの永続化
- シングルユーザー前提（認証不要）

確定済みの前提：

- **ランタイム**: Node.js 24（devcontainer で設定済み）
- **言語**: TypeScript strict モード（CLAUDE.md で規定済み）
- **パッケージ管理**: pnpm + workspace プロトコル（CLAUDE.md で規定済み）

## Considered Alternatives

### モノレポ構成

| # | 選択肢 | 判定 |
| - | --- | --- |
| A | pnpm workspace + Turborepo | **採用** — pnpm 既定の workspace 機能を活用し、Turborepo でビルドキャッシュ・タスクオーケストレーションを効率化 |
| B | pnpm workspace のみ（Turborepo なし） | 却下 — パッケージ間のビルド順序やキャッシュを手動管理する負担が大きい |
| C | Nx | 却下 — 機能は豊富だが設定が重く、MVP 規模ではオーバースペック |

### フロントエンド

| # | 選択肢 | 判定 |
| - | --- | --- |
| A | Next.js (App Router) | **採用** — React エコシステム最大のフルスタックフレームワーク。RSC・Server Actions による最新の React パターンを学べる。将来的な SSR/SEO 対応にも備えられる |
| B | React + Vite (SPA) | 却下 — SSR 不要な MVP にはシンプルだが、Next.js の学習価値と将来拡張性を優先 |
| C | Remix | 却下 — Web 標準準拠で設計は優れるがエコシステムが小さく、リアルタイム表示主体の本 MVP では強みが活きにくい |

### バックエンド API

| # | 選択肢 | 判定 |
| - | --- | --- |
| A | Hono | **採用** — Web Standard API ベース、TypeScript ファースト、型安全なルーティング。軽量かつ組み込み WebSocket サポートあり。Node.js 24 との相性良好 |
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
| A | Biome | **採用** — ESLint + Prettier を 1 ツールに統合。Rust 製で高速、設定が少ない。2026 年の主流ツール |
| B | ESLint + Prettier | 却下 — 実績は豊富だが 2 ツールの設定・競合管理が煩雑。Biome で統合できる |

### リアルタイム通信

| # | 選択肢 | 判定 |
| - | --- | --- |
| A | Hono 組み込み WebSocket | **採用** — バックエンドと統一的なミドルウェア体系で扱える。MVP のスコープ（エージェント単位のステータス + ストリーミング表示）には十分 |
| B | Socket.IO | 却下 — 高レベル機能は豊富だが抽象度が高く、WebSocket の理解が深まらない |
| C | ws（生 WebSocket） | 却下 — 低レベルすぎて MVP のスピードに不向き |

## Decision

### 技術スタック一覧

| レイヤー | 技術 | バージョン方針 |
| --- | --- | --- |
| ランタイム | Node.js 24 | devcontainer で固定 |
| 言語 | TypeScript (strict) | 最新安定版 |
| パッケージ管理 | pnpm | devcontainer 同梱版 |
| モノレポ | Turborepo | 最新安定版 |
| フロントエンド | Next.js (App Router) | 最新安定版 |
| UI コンポーネント | shadcn/ui + Tailwind CSS v4 | 最新安定版 |
| バックエンド | Hono | 最新安定版 |
| WebSocket | Hono 組み込み WebSocket | Hono に同梱 |
| データベース | PostgreSQL | devcontainer で固定 |
| ORM | Drizzle ORM | 最新安定版 |
| LLM | Anthropic SDK (Claude API) | 最新安定版 |
| Lint / Format | Biome | 最新安定版 |

### モノレポ構成

```
agent-team-studio/
├── apps/
│   ├── web/              # Next.js (App Router) — UI
│   └── api/              # Hono — API サーバー + WebSocket
├── packages/
│   ├── shared/           # フロント・バックエンド共有の型定義
│   ├── agent-core/       # エージェント実行エンジン
│   └── db/               # Drizzle スキーマ・マイグレーション
├── pnpm-workspace.yaml
├── package.json
├── tsconfig.base.json
├── biome.json
└── turbo.json
```

### パッケージ間の依存方向

```
apps/web → packages/shared
apps/api → packages/shared, packages/agent-core, packages/db
packages/agent-core → packages/shared
packages/db → packages/shared
```

依存は常に apps → packages、packages → packages の一方向。循環依存は禁止する。

### Next.js + Hono の役割分担

- **Next.js (apps/web)**: UI レンダリング、クライアントサイドの状態管理、WebSocket クライアント。Server Components / Server Actions は UI 層に閉じた利用に留め、ビジネスロジックは置かない
- **Hono (apps/api)**: REST API、WebSocket サーバー、エージェント実行の制御。ビジネスロジックとデータアクセスはすべて API サーバー経由

この分離により、フロントエンドフレームワークの変更がバックエンドに影響しない構造を維持する。

### 開発環境

devcontainer に PostgreSQL コンテナを追加する。設定は #12（CI/CD・開発環境）で詳細化する。

## Consequences

### ポジティブ

- TypeScript ファーストのツールチェーン（Hono, Drizzle, Biome）で統一され、型安全性が高い
- pnpm workspace + Turborepo で、パッケージ間の依存管理とビルド効率が確保される
- Next.js + Hono の分離構成により、フロントエンドとバックエンドを独立して開発・テスト・デプロイできる
- shadcn/ui により UI コンポーネントのカスタマイズ自由度が高く、ライブラリのバージョンロックインがない
- PostgreSQL + Drizzle により、本格的な RDBMS 運用を学びつつ型安全なデータアクセスが可能

### ネガティブ / リスク

- Next.js App Router は抽象度が高く、フレームワーク固有の学習コストがある（RSC, Server Actions のメンタルモデル習得が必要）
- Next.js と Hono の 2 サーバー構成により、開発時の起動・CORS 設定・デプロイ構成がやや複雑になる
- PostgreSQL は devcontainer へのコンテナ追加が必要で、SQLite に比べ初期セットアップが重い
- Hono は急成長中だが Next.js / Express に比べエコシステムが小さく、ニッチな問題の解決策が見つかりにくい場合がある
- Biome は ESLint ほどのプラグインエコシステムがなく、特殊なルール追加には制約がある
