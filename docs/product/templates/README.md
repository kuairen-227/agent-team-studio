# テンプレート仕様（プロダクト視点）

MVP シードテンプレートの、ユーザーに見える振る舞い仕様。観点の定義・プロンプト本文・出力構造・UI 表記・失敗時 UX を扱う。

実装仕様（JSON Schema・`Template.definition` 格納形式・LLM 呼び出しパラメータ・内部 JSON 出力スキーマ）は [docs/design/templates/](../../design/templates/README.md) を参照。

## ドキュメント一覧

| ドキュメント | 内容 |
| --- | --- |
| [competitor-analysis.md](./competitor-analysis.md) | 競合調査テンプレート（MVP Hero Use Case） |

## 追加ルール

- 1 テンプレート = 1 ファイル（`<template-id>.md`）
- 記述項目: Hero UC との関係 / エージェント構成 / 観点の意味づけ / 入力項目（ユーザー視点） / システムプロンプト本文 / 出力 Markdown 構造 / 失敗時 UX
- 対応する実装仕様は `docs/design/templates/<template-id>.md` に配置し、両 doc を相互参照する
- MVP ではシードテンプレート 1 本（競合調査）のみ。ユーザーによる作成・編集は v2 以降（[ADR-0005](../../adr/0005-mvp-scope.md) Non-goals）
