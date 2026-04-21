# テンプレート詳細仕様

MVP シードテンプレートの詳細仕様を管理するディレクトリ。`Template.definition`（JSONB）に格納する内容を具体化し、シード投入・エージェント実行・結果レンダリングの前提を揃える。

用語は [glossary.md](../../product/glossary.md) に準拠する（Template / Investigation Agent / Integration Agent / Perspective / Reference / Result / Matrix）。

## ドキュメント一覧

| ドキュメント | 内容 |
| --- | --- |
| [competitor-analysis.md](./competitor-analysis.md) | 競合調査テンプレート（MVP Hero Use Case） |

## 追加ルール

- 1 テンプレート = 1 ファイル（`<template-id>.md`）
- 記述項目: 位置付け / エージェント構成 / 入力パラメータスキーマ / システムプロンプト本文 / 出力フォーマット / LLM 呼び出しパラメータ
- MVP ではシードテンプレート 1 本（競合調査）のみ。ユーザーによる作成・編集は v2 以降（[ADR-0005](../../adr/0005-mvp-scope.md) Non-goals）
