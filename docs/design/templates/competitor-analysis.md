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
    "reference": {
      "type": "string",
      "description": "ユーザーが任意で貼り付ける参考情報。URL を貼り付けても Web 取得は行わない",
      "maxLength": 10000
    }
  }
}
```

MVP では観点（`strategy` / `product` / `investment` / `partnership` の 4 種）は API 入力として受け付けず、実装側が常に固定 4 観点をエージェント起動時に付与する。ユーザー編集対応（観点の追加・削除）は v2 以降（[ADR-0005](../../adr/0005-mvp-scope.md) Non-goals）。v2 で入力受け付けを導入する際は `perspectives` フィールドを Schema に追加する。

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

### 失敗観点の表現ルール

`matrix[].cells` と `missing` の関係は以下に統一する。Markdown と内部 JSON が同一内容を指すこと（Integration Agent プロンプトの指示 5）を保証するための責務分離:

- **`matrix[].cells`**: Investigation Agent が成功した観点のみを含む。該当観点の成功セルのみを列挙する（失敗観点はここに現れない）
- **`matrix[]` の一意性**: `perspective` 値は 1 要素につき 1 個まで（同一 perspective の重複不可）。JSON Schema では表現しづらいため、実装時（Zod 移植時）に `.refine()` で保証する
- **`missing`**: 失敗・情報不足だった観点を列挙する。`reason` は `agent_failed`（Agent 自体が失敗）と `insufficient_evidence`（全 findings が `evidence_level: insufficient`）の 2 種
- **`source_evidence_level`**: Investigation Agent の `evidence_level` を転記した値。`agent_failed` は含まない（失敗観点は `matrix[].cells` に現れないため）

Markdown レポートでは `matrix` 内の観点行のセルに要点を描画し、`missing` に含まれる観点の行は全セルを「情報不足」と表示する。

個別 Investigation Agent 出力も Result に併せて保存する（統合失敗時の個別結果表示、[US-4](../../product/user-stories.md#us-4-統合結果を閲覧しエクスポートする) 受入基準）。永続化テーブル設計は A2 で確定。

## 関連ドキュメント

- [product/templates/competitor-analysis.md](../../product/templates/competitor-analysis.md)（プロダクト視点の仕様）
- [ADR-0005 MVP スコープ](../../adr/0005-mvp-scope.md)
- A2 データモデル設計（[Issue #52](https://github.com/kuairen-227/agent-team-studio/issues/52)）
- A3 LLM 呼び出し方針（[Issue #51](https://github.com/kuairen-227/agent-team-studio/issues/51)）
- A4 エージェント実行アーキテクチャ（[Issue #53](https://github.com/kuairen-227/agent-team-studio/issues/53)）
