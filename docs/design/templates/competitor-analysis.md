# 競合調査テンプレート I/O スキーマ

MVP 競合調査テンプレート固有の入出力契約。本 doc の範囲は「このテンプレート固有の I/O 型」に限定する。

プロダクト視点の仕様（観点の意味づけ・システムプロンプト本文・出力 Markdown 構造・失敗時 UX）は [docs/product/templates/competitor-analysis.md](../../product/templates/competitor-analysis.md) を参照。

下記のテンプレート横断事項はこのテンプレートに閉じない設計判断のため、各サブ Issue 側で確定する（A1 #50 時点の前提メモは各 Issue のコメントに残した）:

| 事項 | 確定先 |
| --- | --- |
| `Template.definition` の JSONB 格納方針・テンプレート置換方式 | A2 データモデル設計（[Issue #52](https://github.com/kuairen-227/agent-team-studio/issues/52)） |
| エージェント ID 命名規約・並列実行制御・部分失敗ハンドリング | A4 エージェント実行アーキテクチャ（[Issue #53](https://github.com/kuairen-227/agent-team-studio/issues/53)） |
| LLM モデル選定・`model` / `temperature` / `max_tokens` | A3 LLM 呼び出し方針（[Issue #51](https://github.com/kuairen-227/agent-team-studio/issues/51)） |

## 入力パラメータ JSON Schema

実装時の型定義は `packages/shared/src/domain-types.ts` に配置する想定。

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "CompetitorAnalysisParameters",
  "type": "object",
  "required": ["competitors"],
  "properties": {
    "competitors": {
      "type": "array",
      "description": "調査対象の競合企業名",
      "items": { "type": "string", "minLength": 1, "maxLength": 100 },
      "minItems": 1,
      "maxItems": 5
    },
    "perspectives": {
      "type": "array",
      "description": "調査観点。MVP では固定の 4 観点を既定値として自動付与し、ユーザーによる編集は不可",
      "items": {
        "type": "string",
        "enum": ["strategy", "product", "investment", "partnership"]
      },
      "default": ["strategy", "product", "investment", "partnership"],
      "readOnly": true
    },
    "reference": {
      "type": "string",
      "description": "ユーザーが任意で貼り付ける参考情報。URL を貼り付けても Web 取得は行わない",
      "maxLength": 10000
    }
  }
}
```

制約値（`maxItems: 5` / `maxLength: 10000` 等）の根拠は [product doc の入力項目](../../product/templates/competitor-analysis.md#入力項目ユーザー視点) を参照。

## 内部 JSON 出力スキーマ

### Investigation Agent 出力

```json
{
  "perspective": "strategy" | "product" | "investment" | "partnership",
  "findings": [
    {
      "competitor": "<企業名>",
      "points": ["<要点1>", "<要点2>"],
      "evidence_level": "strong" | "moderate" | "weak" | "insufficient",
      "notes": "<補足（任意、情報不足の理由等）>"
    }
  ]
}
```

`evidence_level` の判定基準は Investigation Agent のプロンプト（[product doc](../../product/templates/competitor-analysis.md#investigation-agent共通ひな型)）で LLM に判定させる。`insufficient` の場合、Integration Agent はそのセルを「情報不足」として扱う。

### Integration Agent 出力（内部保持用 JSON）

Markdown レポートと並行して保存する機械可読形式。UI でのセルハイライトや v2 での再利用に備える。

```json
{
  "matrix": [
    {
      "perspective": "strategy" | "product" | "investment" | "partnership",
      "cells": [
        {
          "competitor": "<企業名>",
          "summary": "<要点>",
          "source_evidence_level": "strong" | "moderate" | "weak" | "insufficient"
        }
      ]
    }
  ],
  "overall_insights": ["<所見1>", "<所見2>"],
  "missing": [
    {
      "perspective": "strategy" | "product" | "investment" | "partnership",
      "reason": "agent_failed" | "insufficient_evidence"
    }
  ]
}
```

個別 Investigation Agent 出力も Result に併せて保存する（統合失敗時の個別結果表示、[US-4](../../product/user-stories.md#us-4-統合結果を閲覧しエクスポートする) 受入基準）。永続化テーブル設計は A2 で確定。

## 関連ドキュメント

- [product/templates/competitor-analysis.md](../../product/templates/competitor-analysis.md)（プロダクト視点の仕様）
- [ADR-0005 MVP スコープ](../../adr/0005-mvp-scope.md)
- A2 データモデル設計（[Issue #52](https://github.com/kuairen-227/agent-team-studio/issues/52)）
- A3 LLM 呼び出し方針（[Issue #51](https://github.com/kuairen-227/agent-team-studio/issues/51)）
- A4 エージェント実行アーキテクチャ（[Issue #53](https://github.com/kuairen-227/agent-team-studio/issues/53)）
