/**
 * テンプレート定義の agents から「調査される観点」を抽出する純関数。
 *
 * 観点は investigation エージェントの specialization に紐づく（domain-types.ts）。
 * 入力フォームで実行前に観点を提示し透明性を高めるため（#228 V4）、表示用に
 * name / description を取り出す。テンプレート駆動なので、将来テンプレートが
 * 複数定義されても選択中テンプレートの観点をそのまま表示できる。
 */

import type { AgentDefinition } from "@agent-team-studio/shared";

/** 表示用に整形した調査観点。`key` は React の key 兼観点識別子。 */
export type Perspective = {
  key: string;
  name: string;
  description: string;
};

export function extractPerspectives(agents: AgentDefinition[]): Perspective[] {
  return agents
    .filter((agent) => agent.role === "investigation")
    .map((agent) => ({
      key: agent.specialization.perspective_key,
      name: agent.specialization.perspective_name_ja,
      description: agent.specialization.perspective_description,
    }));
}
