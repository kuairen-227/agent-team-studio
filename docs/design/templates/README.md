# テンプレート実装仕様

MVP シードテンプレートの実装仕様を管理するディレクトリ。`Template.definition`（JSONB）格納形式・入力パラメータ JSON Schema・内部 JSON 出力スキーマ・LLM 呼び出しパラメータなど、実装ブロッカー解消を目的とする技術仕様を扱う。

プロダクト視点の仕様（観点の意味づけ・システムプロンプト本文・出力 Markdown 構造・失敗時 UX）は [docs/product/templates/](../../product/templates/README.md) を参照。

## ドキュメント一覧

| ドキュメント | 内容 |
| --- | --- |
| [competitor-analysis.md](./competitor-analysis.md) | 競合調査テンプレートの実装仕様（MVP Hero Use Case） |

## 追加ルール

- 1 テンプレート = 1 ファイル（`<template-id>.md`）
- 記述項目: エージェント ID と実行順序 / 入力パラメータ JSON Schema / 内部 JSON 出力スキーマ / `Template.definition` 格納方針 / LLM 呼び出しパラメータ
- 対応するプロダクト視点の仕様は `docs/product/templates/<template-id>.md` に配置し、両 doc を相互参照する
- MVP ではシードテンプレート 1 本（競合調査）のみ。ユーザーによる作成・編集は v2 以降（[ADR-0005](../../adr/0005-mvp-scope.md) Non-goals）
