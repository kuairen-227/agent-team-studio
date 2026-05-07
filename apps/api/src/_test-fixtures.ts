/**
 * テスト用の共通 Template fixture。複数テストファイルで独立定義すると
 * `description` 等の些細な差分が紛れ込むため、本ファイルに集約する。
 *
 * `_` プレフィックスはテスト専用ヘルパであることを示すローカル規約
 * （`packages/db/src/schema/_helpers.ts` と同じ運用）。
 */

import type { Template, TemplateSummary } from "@agent-team-studio/shared";

/** 単体テスト用の共通 `Template` フィクスチャ。 */
export const fixtureTemplate: Template = {
  id: "tpl-1",
  name: "競合調査",
  description: "MVP 唯一のテンプレート",
  definition: {
    schema_version: "1",
    input_schema: {},
    agents: [
      {
        role: "investigation",
        agent_id: "investigator-strategy",
        specialization: {
          perspective_key: "strategy",
          perspective_name_ja: "戦略",
          perspective_description: "事業戦略・ポジショニング",
        },
        system_prompt_template: "...",
      },
      {
        role: "integration",
        agent_id: "integrator",
        system_prompt_template: "...",
      },
    ],
    llm: {
      model: "claude-sonnet-4-5",
      temperature_by_role: { investigation: 0.3, integration: 0.2 },
      max_tokens_by_role: { investigation: 4096, integration: 8192 },
    },
  },
  created_at: "2026-05-01T00:00:00.000Z",
  updated_at: "2026-05-02T00:00:00.000Z",
};

/** `fixtureTemplate` から生成したテスト用 `TemplateSummary` 配列。 */
export const fixtureTemplateSummaries: TemplateSummary[] = [
  {
    id: fixtureTemplate.id,
    name: fixtureTemplate.name,
    description: fixtureTemplate.description,
  },
];
