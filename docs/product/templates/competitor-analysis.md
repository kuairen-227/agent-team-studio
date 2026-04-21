# 競合調査テンプレート仕様（プロダクト視点）

MVP Hero Use Case「競合調査の並列深掘り」を構成するエージェントチームの、ユーザーに見える振る舞い仕様。観点の定義・プロンプト本文・出力構造・UI 表記・失敗時 UX を扱う。

テンプレート固有の I/O スキーマ（入力 JSON Schema、内部 JSON 出力型）は [docs/design/templates/competitor-analysis.md](../../design/templates/competitor-analysis.md) を参照。下記のテンプレート横断事項は各サブ Issue で確定する:

- `Template.definition` JSONB 格納方針・テンプレート置換方式 → [A2 Issue #52](https://github.com/kuairen-227/agent-team-studio/issues/52)
- エージェント ID 命名規約・並列実行制御・部分失敗ハンドリング → [A4 Issue #53](https://github.com/kuairen-227/agent-team-studio/issues/53)
- LLM モデル選定・呼び出しパラメータ → [A3 Issue #51](https://github.com/kuairen-227/agent-team-studio/issues/51)

用語は [glossary.md](../glossary.md) に準拠する（Template / Investigation Agent / Integration Agent / Perspective / Reference / Result / Matrix）。

## Hero UC との関係

> 月次の事業戦略レビュー前、競合 3 社の直近動向を観点別（戦略 / 製品 / 投資 / パートナーシップ）に比較整理し、役員提案の裏付けを 30 分以内に固める（[ADR-0004 JTBD](../../adr/0004-target-users.md) / [ADR-0005 Hero Use Case](../../adr/0005-mvp-scope.md)）。

本テンプレートは上記 JTBD の完遂手段として、Investigation Agent × 4（観点別）＋ Integration Agent × 1 のチーム構成を提供する。MVP のシードテンプレートは本テンプレート 1 本のみ。

## エージェント構成

4 体の Investigation Agent が観点別に並列実行し、完了後に 1 体の Integration Agent が統合してマトリクスを生成する。

| 役割 | 観点 | 数 | 主な責務 |
| --- | --- | --- | --- |
| Investigation Agent | 戦略 | 1 | 戦略観点での競合別所見を抽出 |
| Investigation Agent | 製品 | 1 | 製品観点での競合別所見を抽出 |
| Investigation Agent | 投資 | 1 | 投資観点での競合別所見を抽出 |
| Investigation Agent | パートナーシップ | 1 | パートナーシップ観点での競合別所見を抽出 |
| Integration Agent | — | 1 | 4 観点を統合し、観点×競合のマトリクスを生成 |

エージェント ID 命名・実行順序・並列制御の技術的定義は A4（[Issue #53](https://github.com/kuairen-227/agent-team-studio/issues/53)）で確定する。

## 観点の意味づけ

MVP では下記 4 観点を**固定**で提示する。ユーザーによる追加・削除・編集は v2 以降（[ADR-0005](../../adr/0005-mvp-scope.md) Non-goals: テンプレートのユーザー作成・編集）。

| 観点 | 日本語 UI ラベル | 含める情報 |
| --- | --- | --- |
| `strategy` | 戦略 | 事業ミッション・ビジョン、注力セグメント、地理的展開、直近の戦略発表、組織再編 |
| `product` | 製品 | 主力プロダクトの機能・価格、直近のリリース / アップデート、差別化ポイント、ターゲット顧客層 |
| `investment` | 投資 | 直近の資金調達（金額・投資家・バリュエーション）、M&A の実施 / 対象、主要株主の動向 |
| `partnership` | パートナーシップ | 技術提携・販売提携・共同開発、主要顧客 / 導入事例、エコシステム（プラグイン・SDK 等）の連携先 |

表示順は `strategy` → `product` → `investment` → `partnership`。ADR-0004 / ADR-0005 の記述順を踏襲する。

## 入力項目（ユーザー視点）

[US-2 調査パラメータを入力して実行する](../user-stories.md#us-2-調査パラメータを入力して実行する) に沿う。

| 項目 | 必須 | 上限 | 説明 |
| --- | --- | --- | --- |
| 競合企業名 | 必須 | 1〜5 件（MVP 想定は 3 件） | Hero UC の想定は競合 3 社。上限の根拠は 30 分完遂と LLM コスト（MVP 成功基準 1） |
| 観点リスト | 固定 | 4 観点 | MVP では編集不可。上記 4 観点を自動付与 |
| 参考情報 | 任意 | 10,000 文字 | ユーザーが任意で貼り付けるテキスト。URL を貼り付けた場合も Web 取得は行わず、文字列のまま LLM に渡す（[ADR-0005](../../adr/0005-mvp-scope.md) 外部検索 Non-goal） |

### バリデーション振る舞い（US-2 整合）

[US-2 受入基準](../user-stories.md#us-2-調査パラメータを入力して実行する)「必須項目が未入力の場合、実行ボタンが押下できない（もしくはエラー表示）」に準じる。

| 条件 | UI 振る舞い |
| --- | --- |
| 競合企業名が 0 件 | 実行ボタン非活性 |
| 競合企業名が 6 件以上 | 6 件目以降の入力欄を追加不可（＋ボタン非活性）。既に 6 件以上ある状態（例: 過去データ復元等）では実行ボタン非活性＋「競合企業は 5 件までです」とエラー表示 |
| 参考情報が 10,000 文字超 | 超過分の入力を block し、残文字数をカウンタ表示 |

参考情報の文字数上限は暫定値。A3（[Issue #51](https://github.com/kuairen-227/agent-team-studio/issues/51)）のトークン見積もりで見直す。

## システムプロンプト

各エージェントのシステムプロンプト本文を以下に示す。本文はテンプレート文字列として保持し、実行時に `{{competitors}}` / `{{reference_or_empty}}` / 他エージェント出力を埋め込む。具体的な格納形式・置換方式は A2（[Issue #52](https://github.com/kuairen-227/agent-team-studio/issues/52)）で確定する。

### Investigation Agent（共通ひな型）

````text
あなたは企業リサーチの専門家です。指定された観点で、競合企業の直近動向を簡潔に整理します。

## 観点
{{perspective_name_ja}}（{{perspective_description}}）

## 入力
- 調査対象企業リスト: {{competitors}}
- 参考情報（任意）: {{reference_or_empty}}

## 指示
1. 上記の各企業について、指定観点に関する要点を 3〜5 個の箇条書きで抽出する
2. 根拠となる事実（製品名 / 数値 / 発表時期 / 関係者名など）を可能な範囲で含める
3. 不明な点は「情報不足」と明記し、推測で埋めない
4. 参考情報が提供されている場合は、その内容を優先的に参照する
5. 最終出力は指定された JSON フォーマットに厳密に従う

## 禁止事項
- Web 検索や外部 URL へのアクセスを試みない（参考情報は事前提供のテキストのみ）
- 事実と推測を混在させない
- 他の観点（本エージェントの担当外）には言及しない

## 出力フォーマット
以下の JSON のみを出力する。前後に説明文を付けない。

```json
{
  "perspective": "{{perspective_key}}",
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
````

### Investigation Agent の specialization

共通ひな型の `{{perspective_name_ja}}` / `{{perspective_description}}` / `{{perspective_key}}` に「観点の意味づけ」節の値を差し込む。

### Integration Agent

````text
あなたは事業戦略アナリストです。複数の観点で調査された情報を統合し、意思決定者が一覧比較しやすいマトリクス形式のレポートを生成します。

## 入力
- 調査対象企業リスト: {{competitors}}
- Investigation Agent の出力（各観点の出力 JSON をまとめた配列）: {{investigation_results}}
- 参考情報（任意）: {{reference_or_empty}}

## 指示
1. 観点×競合のマトリクスを生成する。行＝観点（戦略 / 製品 / 投資 / パートナーシップ）、列＝競合企業
2. 各セルには、その観点×企業で最も重要な 1〜3 点を簡潔に記述する
3. 観点をまたいだ全体所見（3〜5 行）をマトリクスの末尾に追加する
4. ある観点の Investigation Agent 出力が欠落している、もしくは該当競合の全 findings が `evidence_level: insufficient` の場合、その観点を `missing` 配列に入れ、`matrix[].cells` には含めない
5. 出力は Markdown と、内部保持用 JSON の 2 形式。両者が同一内容を指すこと

## 禁止事項
- 入力にない情報を捏造しない
- 企業ごと・観点ごとの分量を極端に偏らせない
- Investigation Agent の出力と矛盾する記述をしない（矛盾を発見した場合は「Investigation Agent 間で情報に齟齬あり」と所見欄に明記する）

## 出力フォーマット
以下の 2 ブロックを続けて出力する。

### 1. Markdown レポート
- 見出し構造は「## 観点×競合マトリクス」→ 表 → 「## 全体所見」の順
- 表のヘッダ: 空セル + 競合企業名
- 行ヘッダ: 観点の日本語ラベル。`missing` に含まれる観点の行は、全セルを「情報不足」と記述する

### 2. 内部 JSON
以下のスキーマで出力する。

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
````

## 出力（ユーザー向け Markdown）

Integration Agent の Markdown 出力が結果画面に表示され、そのままエクスポートされる（[US-4](../user-stories.md#us-4-統合結果を閲覧しエクスポートする)）。

```markdown
## 観点×競合マトリクス

|  | Company A | Company B | Company C |
| --- | --- | --- | --- |
| 戦略 | ... | ... | ... |
| 製品 | ... | ... | ... |
| 投資 | ... | ... | ... |
| パートナーシップ | ... | ... | 情報不足 |

## 全体所見

- ...
- ...
```

内部保持用 JSON の型は [design/templates/competitor-analysis.md](../../design/templates/competitor-analysis.md) を参照。

## 失敗時のふるまい（ユーザー視点）

[US-3](../user-stories.md#us-3-エージェントの進捗をリアルタイムで見る)（進捗画面）→ [US-4](../user-stories.md#us-4-統合結果を閲覧しエクスポートする)（結果画面）の 2 段階 UX で表現する。進捗画面では各エージェントの失敗を即時に見せ、結果画面では最終成果物として「情報不足」を明示する役割分担。

| 状況 | US-3 進捗画面でのふるまい | US-4 結果画面でのふるまい |
| --- | --- | --- |
| 一部の Investigation Agent が失敗 | 該当エージェントを `failed` 表示し、原因メッセージを併記 | Integration Agent は完了分のみで統合。失敗観点は Markdown / UI で「情報不足」と明示 |
| Integration Agent が失敗 | `integration:matrix` を `failed` 表示し、原因メッセージを併記 | 統合レポートの代わりに個別 Investigation Agent の出力を閲覧可能にする |
| 全 Investigation Agent が失敗 | 各 Investigation Agent を `failed` 表示。Integration Agent は起動しない | 実行を `failed` として表示。各 Investigation Agent の原因メッセージを併記 |

原因メッセージの語は [glossary.md](../glossary.md) の `failed` 項に準拠。実装上のクリーンアップ方針・具体的な状態遷移は A4（[Issue #53](https://github.com/kuairen-227/agent-team-studio/issues/53)）で確定する。

## 関連ドキュメント

- [ADR-0003 プロダクトコンセプト](../../adr/0003-product-concept.md)
- [ADR-0004 ターゲットユーザー](../../adr/0004-target-users.md)
- [ADR-0005 MVP スコープ](../../adr/0005-mvp-scope.md)
- [user-stories.md](../user-stories.md)（US-1 / US-2 / US-3 / US-4）
- [glossary.md](../glossary.md)
- [screen-flow.md](../screen-flow.md)
- [design/templates/competitor-analysis.md](../../design/templates/competitor-analysis.md)（I/O スキーマ）
