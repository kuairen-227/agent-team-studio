import { describe, expect, test } from "bun:test";
import type { AgentDefinition } from "@agent-team-studio/shared";
import { extractPerspectives } from "./extractPerspectives";

function investigationAgent(
  key: string,
  nameJa: string,
  description: string,
): AgentDefinition {
  return {
    role: "investigation",
    agent_id: `investigation_${key}`,
    specialization: {
      perspective_key: key,
      perspective_name_ja: nameJa,
      perspective_description: description,
    },
    system_prompt_template: "",
  };
}

const integrationAgent: AgentDefinition = {
  role: "integration",
  agent_id: "integration",
  system_prompt_template: "",
};

describe("extractPerspectives", () => {
  test("investigation エージェントのみを観点として抽出する", () => {
    const agents: AgentDefinition[] = [
      investigationAgent("strategy", "戦略", "事業ミッション"),
      investigationAgent("product", "製品", "主力プロダクト"),
      integrationAgent,
    ];

    const result = extractPerspectives(agents);

    expect(result).toEqual([
      { key: "strategy", name: "戦略", description: "事業ミッション" },
      { key: "product", name: "製品", description: "主力プロダクト" },
    ]);
  });

  test("agents の並び順を保持する", () => {
    const agents: AgentDefinition[] = [
      investigationAgent("c", "C", "c-desc"),
      investigationAgent("a", "A", "a-desc"),
      investigationAgent("b", "B", "b-desc"),
    ];

    const result = extractPerspectives(agents);

    expect(result.map((p) => p.key)).toEqual(["c", "a", "b"]);
  });

  test("investigation が無い場合は空配列を返す", () => {
    expect(extractPerspectives([integrationAgent])).toEqual([]);
    expect(extractPerspectives([])).toEqual([]);
  });
});
