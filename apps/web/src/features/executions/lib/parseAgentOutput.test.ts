import { describe, expect, it } from "bun:test";
import { parseAgentOutput } from "./parseAgentOutput";

const validInvestigation = {
  perspective: "strategy",
  findings: [
    {
      competitor: "A社",
      points: ["要点1", "要点2"],
      evidence_level: "moderate",
    },
    {
      competitor: "B社",
      points: ["要点3"],
      evidence_level: "strong",
      notes: "補足",
    },
  ],
};

describe("parseAgentOutput", () => {
  it("調査エージェントの正常な JSON を investigation として構造化する", () => {
    const result = parseAgentOutput(
      "investigation_strategy",
      JSON.stringify(validInvestigation),
    );
    expect(result.kind).toBe("investigation");
    if (result.kind !== "investigation") throw new Error("unreachable");
    expect(result.data.perspective).toBe("strategy");
    expect(result.data.findings).toHaveLength(2);
    expect(result.data.findings[1]?.notes).toBe("補足");
  });

  it("```json フェンスで囲まれた出力も構造化する", () => {
    const fenced = `\`\`\`json\n${JSON.stringify(validInvestigation)}\n\`\`\``;
    const result = parseAgentOutput("investigation_product", fenced);
    expect(result.kind).toBe("investigation");
    if (result.kind !== "investigation") throw new Error("unreachable");
    expect(result.data.perspective).toBe("strategy");
    expect(result.data.findings).toHaveLength(2);
  });

  it("壊れた JSON は unstructured へフォールバックする", () => {
    const broken = '{"perspective": "strategy", "findings": [';
    const result = parseAgentOutput("investigation_investment", broken);
    expect(result.kind).toBe("unstructured");
    if (result.kind !== "unstructured") throw new Error("unreachable");
    expect(result.raw).toBe(broken);
  });

  it("ストリーミング途中の部分 JSON は unstructured へフォールバックする", () => {
    const partial = '{"perspective": "str';
    const result = parseAgentOutput("investigation_partnership", partial);
    expect(result.kind).toBe("unstructured");
    if (result.kind !== "unstructured") throw new Error("unreachable");
    expect(result.raw).toBe(partial);
  });

  it("shape 不正（evidence_level が不正値）は unstructured へフォールバックする", () => {
    const invalid = JSON.stringify({
      perspective: "strategy",
      findings: [{ competitor: "A社", points: ["x"], evidence_level: "high" }],
    });
    const result = parseAgentOutput("investigation_strategy", invalid);
    expect(result.kind).toBe("unstructured");
    if (result.kind !== "unstructured") throw new Error("unreachable");
    expect(result.raw).toBe(invalid);
  });

  it("shape 不正（perspective が未知キー）は unstructured へフォールバックする", () => {
    const invalid = JSON.stringify({ perspective: "pricing", findings: [] });
    const result = parseAgentOutput("investigation_strategy", invalid);
    expect(result.kind).toBe("unstructured");
    if (result.kind !== "unstructured") throw new Error("unreachable");
    expect(result.raw).toBe(invalid);
  });

  it("notes が null の finding は構造化を維持しつつ notes を省く（型整合）", () => {
    const withNullNotes = JSON.stringify({
      perspective: "strategy",
      findings: [
        {
          competitor: "A社",
          points: ["要点"],
          evidence_level: "weak",
          notes: null,
        },
      ],
    });
    const result = parseAgentOutput("investigation_strategy", withNullNotes);
    expect(result.kind).toBe("investigation");
    if (result.kind !== "investigation") throw new Error("unreachable");
    // normalizeInvestigation で null は省かれ、共有型 notes?: string に準拠する。
    expect(result.data.findings[0]?.notes).toBeUndefined();
  });

  it("findings が空配列でも構造化対象（investigation）として扱う", () => {
    const empty = JSON.stringify({ perspective: "product", findings: [] });
    const result = parseAgentOutput("investigation_product", empty);
    expect(result.kind).toBe("investigation");
    if (result.kind !== "investigation") throw new Error("unreachable");
    expect(result.data.findings).toHaveLength(0);
  });

  it("points が空配列の finding も有効として通す", () => {
    const emptyPoints = JSON.stringify({
      perspective: "investment",
      findings: [
        { competitor: "A社", points: [], evidence_level: "insufficient" },
      ],
    });
    const result = parseAgentOutput("investigation_investment", emptyPoints);
    expect(result.kind).toBe("investigation");
  });

  it("finding の sources を構造化結果へ透過する (#226)", () => {
    const withSources = JSON.stringify({
      perspective: "strategy",
      findings: [
        {
          competitor: "A社",
          points: ["要点"],
          evidence_level: "strong",
          sources: [{ origin: "reference", detail: "見出し『戦略』" }],
        },
      ],
    });
    const result = parseAgentOutput("investigation_strategy", withSources);
    expect(result.kind).toBe("investigation");
    if (result.kind !== "investigation") throw new Error("unreachable");
    expect(result.data.findings[0]?.sources).toEqual([
      { origin: "reference", detail: "見出し『戦略』" },
    ]);
  });

  it("web_search 由来の出典 URL を構造化結果へ透過する (#323)", () => {
    const withWebSearch = JSON.stringify({
      perspective: "strategy",
      findings: [
        {
          competitor: "A社",
          points: ["要点"],
          evidence_level: "strong",
          sources: [
            { origin: "web_search", detail: "https://example.com/news" },
          ],
        },
      ],
    });
    const result = parseAgentOutput("investigation_strategy", withWebSearch);
    expect(result.kind).toBe("investigation");
    if (result.kind !== "investigation") throw new Error("unreachable");
    expect(result.data.findings[0]?.sources).toEqual([
      { origin: "web_search", detail: "https://example.com/news" },
    ]);
  });

  it("不正な origin を含む sources は unstructured へフォールバックする (#226)", () => {
    const invalidOrigin = JSON.stringify({
      perspective: "strategy",
      findings: [
        {
          competitor: "A社",
          points: ["要点"],
          evidence_level: "strong",
          sources: [{ origin: "made_up_origin" }],
        },
      ],
    });
    const result = parseAgentOutput("investigation_strategy", invalidOrigin);
    expect(result.kind).toBe("unstructured");
    if (result.kind !== "unstructured") throw new Error("unreachable");
    expect(result.raw).toBe(invalidOrigin);
  });

  it("統合エージェントは構造化対象外（マトリクスは結果画面が SSoT）", () => {
    const integration = JSON.stringify({
      matrix: [],
      overall_insights: [],
      missing: [],
    });
    const result = parseAgentOutput("integration", integration);
    expect(result.kind).toBe("unstructured");
    if (result.kind !== "unstructured") throw new Error("unreachable");
    expect(result.raw).toBe(integration);
  });

  it("空文字は unstructured へフォールバックする", () => {
    const result = parseAgentOutput("investigation_strategy", "");
    expect(result.kind).toBe("unstructured");
    if (result.kind !== "unstructured") throw new Error("unreachable");
    expect(result.raw).toBe("");
  });
});
