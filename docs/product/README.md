# プロダクトドキュメント

プロダクトの要件・ユーザー視点の仕様を管理するディレクトリ。技術設計は [design](../design/README.md)、意思決定の経緯は [ADR](../adr/README.md) を参照。

## ドキュメント一覧

| ドキュメント | 内容 |
| --- | --- |
| [user-stories.md](./user-stories.md) | MVP ユーザーストーリーと受け入れ基準 |
| [screen-flow.md](./screen-flow.md) | MVP 画面一覧・画面遷移図・US マッピング |
| [glossary.md](./glossary.md) | プロダクトドメイン用語・UI 用語の辞書 |
| [brand.md](./brand.md) | ブランド軸・ボイス&トーン・視覚アイデンティティ方針 |
| [templates/](./templates/README.md) | テンプレート仕様（プロダクト視点。観点・プロンプト・出力構造・失敗時 UX） |

## 配置ガイドライン

[ADR-0013](../adr/0013-doc-placement-policy.md) に基づく。このディレクトリの価値は、コードで表現できない意図・背景・UX を記述すること。

### 置くもの

- ユーザーストーリー・受入基準
- 画面フロー・UI ラベル・UX 仕様
- 用語集（プロダクトドメイン用語）
- ブランド軸・ボイス&トーン
- エージェントの振る舞い仕様（ペルソナ・指示・禁止事項）
- システムプロンプト本文
- 失敗時のユーザー向け UX
- バリデーションルール（ユーザー視点: 何件まで、何文字まで）

### 置かないもの

- JSON Schema 定義 → [design/](../design/README.md)
- 型定義・enum 値のリテラル列挙 → [design/](../design/README.md)
- API エンドポイント・リクエスト/レスポンス型 → [design/](../design/README.md)
- DB テーブル設計・JSONB 格納構造 → [design/](../design/README.md)
- LLM パラメータ（temperature, max_tokens 等）→ [design/](../design/README.md)

### プロンプト内出力フォーマットの扱い

システムプロンプトは本ディレクトリに配置する。ただしプロンプト内の出力フォーマット（JSON 構造）は、自然言語での概要説明 + design/ スキーマへの参照に置き換える。JSON Schema の正式定義は [design/templates/](../design/templates/README.md) が Single Source of Truth。
