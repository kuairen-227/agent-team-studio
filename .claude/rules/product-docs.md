---
paths:
  - "docs/product/**"
---

# docs/product/ 編集ルール

コードで表現できない意図・背景・UX を記述する場所。技術実装の詳細は含まない。

## 置くもの

- ユーザーストーリー・受入基準
- 画面フロー・UI ラベル・UX 仕様
- 用語集（プロダクトドメイン用語）
- ブランド軸・ボイス&トーン
- エージェントの振る舞い仕様（ペルソナ・指示・禁止事項）
- システムプロンプト本文
- 失敗時のユーザー向け UX
- バリデーションルール（ユーザー視点: 何件まで、何文字まで）

## 置かないもの（design/ へ）

- JSON Schema 定義（`"type":`, `"required":`, `"properties":`, `$schema`）
- 型定義・enum 値のリテラル列挙（`"value1" | "value2"` 形式）
- API エンドポイント・リクエスト/レスポンス型
- DB テーブル設計・JSONB 格納構造
- LLM パラメータ（temperature, max_tokens 等）

## プロンプト内出力フォーマット

システムプロンプトの出力フォーマット（JSON 構造）はインライン定義しない。
自然言語での構造概要 + `docs/design/templates/` スキーマへの参照リンクに置き換える。

## コンプライアンスチェック

書いた後に以下を Grep で確認する:

1. `"type":` / `"required":` / `"properties":` / `\$schema` → JSON Schema の混入
2. `" | "` パターン（パイプ区切りの enum リテラル）→ 型定義の混入
3. `temperature` / `max_tokens` / `model:` → LLM パラメータの混入

違反があれば自然言語説明 + design/ 参照リンクに置き換える。

## 参照ルール（ADR-0021）

- 新しい用語を導入する場合は `docs/product/glossary.md` への追加も行う
- design/ への参照は SSoT 接続（プロンプト出力フォーマット → design/templates 等）のみ
- 双方向リンク禁止
- 同一 doc 内で同じリンク先を複数回参照しない（初出 1 回のみ）
