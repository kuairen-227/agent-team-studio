# 技術スタック

ADR-0008 で決定した技術スタックの一覧。

## スタック一覧

| レイヤー | 技術 | 用途 |
| --- | --- | --- |
| ランタイム | Bun | TypeScript ネイティブ実行、パッケージ管理、テスト実行 |
| 言語 | TypeScript (strict) | 全パッケージ共通 |
| モノレポ | Bun workspace + Turborepo | workspace によるパッケージ管理、Turborepo によるビルドキャッシュ・タスクオーケストレーション |
| フロントエンド | React + Vite (SPA) | UI レンダリング。ビルド成果物は Hono から静的配信 |
| ルーティング | React Router v7 | SPA のクライアントサイドルーティング（[ADR-0025](../adr/0025-spa-routing-library.md)） |
| UI コンポーネント | shadcn/ui + Tailwind CSS v4 | Radix UI ベースのコンポーネントをプロジェクトにコピーして使用 |
| バックエンド | Hono | REST API、WebSocket、SPA 配信を 1 サーバーで提供 |
| WebSocket | Hono 組み込み WebSocket | エージェント実行のリアルタイム進捗配信 |
| データベース | PostgreSQL | テンプレート・実行履歴・結果の永続化 |
| ORM | Drizzle ORM | TypeScript ファーストのスキーマ定義、マイグレーション、クエリビルダ |
| テスト | bun:test | Bun 組み込みテストランナー |
| Lint / Format | Biome | ESLint + Prettier 統合。Rust 製で高速 |

## バージョン方針

すべて最新安定版を使用する。`package.json` でバージョンを固定し、定期的に更新する。

## 補足

- **Bun** を採用したことで tsx, vitest 等の追加ツールが不要。ツールチェーンが簡素化される
- **Hono** が SPA 静的ファイルも配信するため、本番は 1 プロセスで完結。CORS 設定不要
- **Drizzle ORM** はスキーマ定義が TypeScript コードそのもので、型安全なデータアクセスが可能
- **shadcn/ui** はライブラリではなくコードコピー方式。バージョンロックインがなくカスタマイズ自由
