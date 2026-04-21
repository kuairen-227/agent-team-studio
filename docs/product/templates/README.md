# テンプレート仕様（プロダクト視点）

MVP シードテンプレートの、ユーザーに見える振る舞い仕様。観点の定義・プロンプト本文・出力構造・UI 表記・失敗時 UX を扱う。

テンプレート固有の I/O スキーマ（入力 JSON Schema・内部 JSON 出力型）は [docs/design/templates/](../../design/templates/README.md) を参照。テンプレート横断の実装事項（`Template.definition` 格納方針・エージェント実行制御・LLM 呼び出しパラメータ）は A2 / A3 / A4 サブ Issue で確定する。

## ドキュメント一覧

| ドキュメント | 内容 |
| --- | --- |
| [competitor-analysis.md](./competitor-analysis.md) | 競合調査テンプレート（MVP Hero Use Case） |

## 追加ルール

- 1 テンプレート = 1 ファイル（`<template-id>.md`）
- 記述項目: Hero UC との関係 / エージェント構成 / 観点の意味づけ / 入力項目（ユーザー視点） / システムプロンプト本文 / 出力 Markdown 構造 / 失敗時 UX
- 対応する I/O スキーマは `docs/design/templates/<template-id>.md` に配置し、両 doc を相互参照する
- MVP ではシードテンプレート 1 本（競合調査）のみ。ユーザーによる作成・編集は v2 以降（[ADR-0005](../../adr/0005-mvp-scope.md) Non-goals）
