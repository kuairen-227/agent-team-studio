# 設計ドキュメント

プロダクトの設計方針・技術仕様のリファレンス。意思決定の経緯は [ADR](../adr/README.md) を参照。

## ドキュメント一覧

| ドキュメント | 内容 |
| --- | --- |
| [tech-stack.md](./tech-stack.md) | 技術スタック一覧 |
| [architecture.md](./architecture.md) | アーキテクチャ概要（構成図・ディレクトリ・レイヤー） |
| [api-design.md](./api-design.md) | API 設計規約（REST・WebSocket・型共有） |
| [llm-integration.md](./llm-integration.md) | LLM 呼び出し方針（モデル選定・ストリーミング・エラーハンドリング・トークン見積もり） |
| [templates/](./templates/README.md) | テンプレート固有の I/O スキーマ（入力 JSON Schema・内部 JSON 出力型）。プロダクト視点の仕様は [docs/product/templates/](../product/templates/README.md)、横断事項は A2/A3/A4 側で確定 |

## 配置ガイドライン

[ADR-0013](../adr/0013-doc-placement-policy.md) に基づく。

### SSoT の原則

実装前はドキュメントが暫定 SSoT。実装後はコード（型定義・スキーマ・テスト）が SSoT となり、ドキュメントはコード参照に移行する。コードで表現できることはコードを唯一のソースとする。

### 置くもの

- 技術スタック・ライブラリ選定
- アーキテクチャ図・レイヤー構成・ディレクトリ設計
- API 設計規約（REST / WebSocket / 型共有）
- LLM 呼び出し方針（モデル選定・パラメータ・ストリーミング）
- データスキーマ（JSON Schema・Zod 定義・DB テーブル設計）
- I/O 契約（入力パラメータ型・内部 JSON 出力型・enum 値の定義）

### 置かないもの

- ユーザーストーリー・受入基準 → [product/](../product/README.md)
- 画面フロー・UI ラベル → [product/](../product/README.md)
- エージェントの振る舞い記述・ペルソナ・プロンプト本文 → [product/](../product/README.md)
- 失敗時の UX フロー → [product/](../product/README.md)
- ビジネス上の根拠・優先度判断 → [product/](../product/README.md) or [adr/](../adr/README.md)

### 相互参照ルール

テンプレートの I/O スキーマは本ディレクトリが正式定義（実装前）。product/ 側のプロンプト仕様からは参照リンクで接続する。スキーマの重複記述は禁止（Single Source of Truth）。
