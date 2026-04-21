# テンプレート I/O スキーマ

MVP シードテンプレート固有の入出力契約（型定義）を管理するディレクトリ。このテンプレートに閉じた JSON Schema・内部 JSON 出力スキーマに限定する。

プロダクト視点の仕様（観点の意味づけ・システムプロンプト本文・出力 Markdown 構造・失敗時 UX）は [docs/product/templates/](../../product/templates/README.md) を参照。下記のテンプレート横断事項は本ディレクトリでは扱わず、各サブ Issue（A2 / A3 / A4）側で確定する:

- `Template.definition` JSONB 格納方針・テンプレート置換方式 → [A2 Issue #52](https://github.com/kuairen-227/agent-team-studio/issues/52)
- エージェント ID 命名規約・並列実行制御・部分失敗ハンドリング → [A4 Issue #53](https://github.com/kuairen-227/agent-team-studio/issues/53)
- LLM モデル選定・`model` / `temperature` / `max_tokens` → [A3 Issue #51](https://github.com/kuairen-227/agent-team-studio/issues/51)

## ドキュメント一覧

| ドキュメント | 内容 |
| --- | --- |
| [competitor-analysis.md](./competitor-analysis.md) | 競合調査テンプレートの I/O スキーマ（MVP Hero Use Case） |

## 追加ルール

- 1 テンプレート = 1 ファイル（`<template-id>.md`）
- 記述項目: 入力パラメータ JSON Schema / 内部 JSON 出力スキーマ
- 対応するプロダクト視点の仕様は `docs/product/templates/<template-id>.md` に配置し、両 doc を相互参照する
