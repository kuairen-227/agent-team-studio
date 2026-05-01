/**
 * 競合調査テンプレートのシードデータ定義。
 *
 * SSoT:
 * - input_schema: docs/design/templates/competitor-analysis.md
 * - system_prompt_template: docs/product/templates/competitor-analysis.md
 * - LlmDefaults 値: docs/design/llm-integration.md
 * - agents の構成: docs/product/templates/competitor-analysis.md
 *
 * 暫定: agent_id 命名規約は A4 (Issue #53) で確定するため、本ファイルは仮値を採用する。
 * 確定後にこのファイルの agent_id を更新する。
 */

import type {
  CompetitorPerspectiveKey,
  TemplateDefinition,
} from "@agent-team-studio/shared";

// ---------- system prompt templates ----------
// product doc の本文を転記。`{{...}}` プレースホルダの置換方式は A2 (Issue #52) で確定。
// MVP では実行時にテンプレ展開ロジック側で対応する想定。

const INVESTIGATION_AGENT_PROMPT = `あなたは企業リサーチの専門家です。指定された観点で、競合企業の直近動向を簡潔に整理します。

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
以下の構造の JSON のみを出力する。前後に説明文を付けない。

- \`perspective\`: 本エージェントが担当する観点キー
- \`findings\`: 競合企業ごとの調査結果配列（企業名・要点リスト・根拠レベル・補足）
`;

const INTEGRATION_AGENT_PROMPT = `あなたは事業戦略アナリストです。複数の観点で調査された情報を統合し、意思決定者が一覧比較しやすいマトリクス形式のレポートを生成します。

## 入力
- 調査対象企業リスト: {{competitors}}
- Investigation Agent の出力（各観点の出力 JSON をまとめた配列）: {{investigation_results}}
- 参考情報（任意）: {{reference_or_empty}}

## 指示
1. 観点×競合のマトリクスを生成する。行＝観点（戦略 / 製品 / 投資 / パートナーシップ）、列＝競合企業
2. 各セルには、その観点×企業で最も重要な 1〜3 点を簡潔に記述する
3. 観点をまたいだ全体所見（3〜5 行）をマトリクスの末尾に追加する
4. ある観点の Investigation Agent 出力が欠落している、もしくは該当競合の全 findings が \`evidence_level: insufficient\` の場合、その観点を \`missing\` 配列に入れ、\`matrix[].cells\` には含めない
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
- 行ヘッダ: 観点の日本語ラベル。\`missing\` に含まれる観点の行は、全セルを「情報不足」と記述する

### 2. 内部 JSON
以下の構造で出力する。

- \`matrix\`: 観点ごとのセル配列（観点キー・競合企業名・要約・根拠レベル）
- \`overall_insights\`: 観点横断の全体所見
- \`missing\`: 欠落した観点とその理由
`;

// ---------- 観点メタデータ ----------
// product doc の §観点の意味づけ から転記。表示順 strategy → product → investment → partnership。

type Perspective = {
  key: CompetitorPerspectiveKey;
  name_ja: string;
  description: string;
};

const PERSPECTIVES: Perspective[] = [
  {
    key: "strategy",
    name_ja: "戦略",
    description:
      "事業ミッション・ビジョン、注力セグメント、地理的展開、直近の戦略発表、組織再編",
  },
  {
    key: "product",
    name_ja: "製品",
    description:
      "主力プロダクトの機能・価格、直近のリリース / アップデート、差別化ポイント、ターゲット顧客層",
  },
  {
    key: "investment",
    name_ja: "投資",
    description:
      "直近の資金調達（金額・投資家・バリュエーション）、M&A の実施 / 対象、主要株主の動向",
  },
  {
    key: "partnership",
    name_ja: "パートナーシップ",
    description:
      "技術提携・販売提携・共同開発、主要顧客 / 導入事例、エコシステム（プラグイン・SDK 等）の連携先",
  },
];

// ---------- TemplateDefinition ----------

export const COMPETITOR_ANALYSIS_TEMPLATE_NAME = "競合調査";

export const competitorAnalysisDefinition: TemplateDefinition = {
  schema_version: "1",
  input_schema: {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: "CompetitorAnalysisParameters",
    type: "object",
    required: ["competitors"],
    properties: {
      competitors: {
        type: "array",
        description: "調査対象の競合企業名",
        items: { type: "string", minLength: 1, maxLength: 100 },
        minItems: 1,
        maxItems: 5,
      },
      reference: {
        type: "string",
        description:
          "ユーザーが任意で貼り付ける参考情報。URL を貼り付けても Web 取得は行わない",
        maxLength: 10000,
      },
    },
  },
  agents: [
    ...PERSPECTIVES.map((p) => ({
      role: "investigation" as const,
      agent_id: `investigation_${p.key}`,
      specialization: {
        perspective_key: p.key,
        perspective_name_ja: p.name_ja,
        perspective_description: p.description,
      },
      system_prompt_template: INVESTIGATION_AGENT_PROMPT,
    })),
    {
      role: "integration",
      agent_id: "integration",
      system_prompt_template: INTEGRATION_AGENT_PROMPT,
    },
  ],
  llm: {
    model: "claude-sonnet-4-6",
    temperature_by_role: { investigation: 0.3, integration: 0.2 },
    max_tokens_by_role: { investigation: 2048, integration: 4096 },
  },
};

export const competitorAnalysisDescription =
  "競合企業を 4 観点（戦略 / 製品 / 投資 / パートナーシップ）で並列調査し、意思決定向けマトリクスに統合する MVP シードテンプレート。";
