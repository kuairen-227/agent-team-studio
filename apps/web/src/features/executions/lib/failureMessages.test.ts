import { describe, expect, it } from "bun:test";
import {
  AGENT_FAIL_REASONS,
  EXECUTION_FAIL_REASONS,
} from "@agent-team-studio/shared";
import {
  describeAgentFailure,
  describeExecutionFailure,
} from "./failureMessages";

describe("describeAgentFailure", () => {
  it("全 reason が空でない label と guidance を返す", () => {
    for (const reason of AGENT_FAIL_REASONS) {
      const { label, guidance } = describeAgentFailure(reason);
      expect(label.length).toBeGreaterThan(0);
      expect(guidance.length).toBeGreaterThan(0);
    }
  });

  it("llm_error は種別を示すラベルと再試行を促す案内を返す", () => {
    const { label, guidance } = describeAgentFailure("llm_error");
    expect(label).toContain("LLM");
    expect(guidance).toContain("再");
  });

  it("timeout はタイムアウトと分かるラベルを返す", () => {
    expect(describeAgentFailure("timeout").label).toContain("タイムアウト");
  });

  it("output_parse_error は解析失敗と分かるラベルを返す", () => {
    expect(describeAgentFailure("output_parse_error").label).toContain("解析");
  });
});

describe("describeExecutionFailure", () => {
  it("全 reason が空でない label と guidance を返す", () => {
    for (const reason of EXECUTION_FAIL_REASONS) {
      const { label, guidance } = describeExecutionFailure(reason);
      expect(label.length).toBeGreaterThan(0);
      expect(guidance.length).toBeGreaterThan(0);
    }
  });

  it("all_investigations_failed は次のアクションを案内する", () => {
    const { guidance } = describeExecutionFailure("all_investigations_failed");
    expect(guidance).toContain("再");
  });

  it("integration_failed は統合の失敗と分かるラベルを返す", () => {
    expect(describeExecutionFailure("integration_failed").label).toContain(
      "統合",
    );
  });

  it("timeout はタイムアウトと分かるラベルを返す", () => {
    expect(describeExecutionFailure("timeout").label).toContain("タイムアウト");
  });
});
