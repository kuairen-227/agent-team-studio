// このファイルは app.ts を経由しないため Zod の日本語ロケール（lib/zod-config.ts）が
// ロードされない。アサートは field キーまでに留め、reason 文言は app.test.ts 側で
// 確認する責務分担とする。
import { describe, expect, test } from "bun:test";
import type {
  AgentExecutionRow,
  ExecutionRow,
  ResultRow,
} from "@agent-team-studio/db";
import type { CompetitorAnalysisParameters } from "@agent-team-studio/shared";
import { fixtureTemplate } from "../_test-fixtures.ts";
import { NotFoundError, ValidationError } from "../lib/errors.ts";
import {
  createExecutionsService,
  type ExecutionsServiceDeps,
} from "./executions.ts";

const validParameters: CompetitorAnalysisParameters = {
  competitors: ["Acme", "Globex"],
  reference: "メモ",
};

const baseExecutionRow: ExecutionRow = {
  id: "exec-1",
  templateId: "tpl-1",
  parameters: validParameters,
  status: "completed",
  errorMessage: null,
  createdAt: new Date("2026-05-04T00:00:00.000Z"),
  startedAt: new Date("2026-05-04T00:01:00.000Z"),
  completedAt: new Date("2026-05-04T00:02:00.000Z"),
};

const investigationAgentRow: AgentExecutionRow = {
  id: "ae-1",
  executionId: "exec-1",
  agentId: "investigation_strategy",
  role: "investigation",
  status: "completed",
  output: null,
  errorMessage: null,
  createdAt: new Date("2026-05-04T00:00:00.000Z"),
  startedAt: new Date("2026-05-04T00:01:00.000Z"),
  completedAt: new Date("2026-05-04T00:02:00.000Z"),
};

const resultRow: ResultRow = {
  id: "result-1",
  executionId: "exec-1",
  markdown: "# レポート",
  structured: {
    matrix: [],
    overall_insights: ["所見1"],
    missing: [],
  },
  createdAt: new Date("2026-05-04T00:02:00.000Z"),
};

const buildService = (overrides: Partial<ExecutionsServiceDeps> = {}) =>
  createExecutionsService({
    getTemplateById: async () => fixtureTemplate,
    createExecution: async () => ({
      id: "exec-1",
      status: "pending",
      createdAt: "2026-05-04T00:00:00.000Z",
    }),
    getExecution: async () => null,
    getAgentExecutionsByExecutionId: async () => [],
    getResultByExecutionId: async () => null,
    listExecutions: async () => [],
    ...overrides,
  });

describe("createExecutionsService.createExecution", () => {
  test("Template から agents を抽出して repo に渡す", async () => {
    let captured:
      | Parameters<ExecutionsServiceDeps["createExecution"]>[0]
      | undefined;
    const service = buildService({
      createExecution: async (input) => {
        captured = input;
        return {
          id: "exec-1",
          status: "pending",
          createdAt: "2026-05-04T00:00:00.000Z",
        };
      },
    });

    const res = await service.createExecution({
      templateId: fixtureTemplate.id,
      parameters: validParameters,
    });

    expect(res).toEqual({
      id: "exec-1",
      status: "pending",
      createdAt: "2026-05-04T00:00:00.000Z",
    });
    expect(captured?.templateId).toBe(fixtureTemplate.id);
    expect(captured?.parameters).toEqual(validParameters);
    // fixture は investigation 1 + integration 1 の 2 件。
    expect(captured?.agents).toEqual([
      { agentId: "investigator-strategy", role: "investigation" },
      { agentId: "integrator", role: "integration" },
    ]);
  });

  test("Template が存在しない場合は NotFoundError", async () => {
    const service = buildService({ getTemplateById: async () => null });

    await expect(
      service.createExecution({
        templateId: "tpl-missing",
        parameters: validParameters,
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  // Zod の path は配列全体エラーで `["competitors"]`、要素エラーで `["competitors", N]` と
  // 構造が異なる。前者は `=== "competitors"`、後者は `startsWith("competitors")` で検証する。

  test("competitors が空配列なら ValidationError", async () => {
    const service = buildService();

    const err = await service
      .createExecution({
        templateId: fixtureTemplate.id,
        parameters: { competitors: [] },
      })
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ValidationError);
    const validation = err as ValidationError;
    expect(validation.details.some((d) => d.field === "competitors")).toBe(
      true,
    );
  });

  test("parameters が {} で competitors キー欠落なら ValidationError", async () => {
    const service = buildService();

    const err = await service
      .createExecution({
        templateId: fixtureTemplate.id,
        // 型レイヤを強引に通して Zod に不正構造を渡し、ランタイム検証経路を確認する。
        parameters: {} as never,
      })
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ValidationError);
    const validation = err as ValidationError;
    expect(validation.details.some((d) => d.field === "competitors")).toBe(
      true,
    );
  });

  test("competitors が 1 件（境界 OK）は通る", async () => {
    const service = buildService();

    const res = await service.createExecution({
      templateId: fixtureTemplate.id,
      parameters: { competitors: ["Acme"] },
    });

    expect(res.id).toBe("exec-1");
  });

  // MVP では重複チェックなし。将来 .refine(unique) を追加するなら破壊的変更となる前提を固定する。
  test("competitors の重複は許容される", async () => {
    const service = buildService();

    const res = await service.createExecution({
      templateId: fixtureTemplate.id,
      parameters: { competitors: ["Acme", "Acme"] },
    });

    expect(res.id).toBe("exec-1");
  });

  test("competitors が 5 件（境界 OK）は通る", async () => {
    const service = buildService();

    const res = await service.createExecution({
      templateId: fixtureTemplate.id,
      parameters: {
        competitors: ["a", "b", "c", "d", "e"],
      },
    });

    expect(res.id).toBe("exec-1");
  });

  test("competitors が 6 件（境界 NG）なら competitors フィールドの ValidationError", async () => {
    const service = buildService();

    const err = await service
      .createExecution({
        templateId: fixtureTemplate.id,
        parameters: {
          competitors: ["a", "b", "c", "d", "e", "f"],
        },
      })
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ValidationError);
    const validation = err as ValidationError;
    expect(validation.details.some((d) => d.field === "competitors")).toBe(
      true,
    );
  });

  test("competitors の各要素が 100 文字（境界 OK）は通る", async () => {
    const service = buildService();

    const res = await service.createExecution({
      templateId: fixtureTemplate.id,
      parameters: { competitors: ["a".repeat(100)] },
    });

    expect(res.id).toBe("exec-1");
  });

  test("competitors の要素が 101 文字（境界 NG）なら ValidationError", async () => {
    const service = buildService();

    const err = await service
      .createExecution({
        templateId: fixtureTemplate.id,
        parameters: { competitors: ["a".repeat(101)] },
      })
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ValidationError);
    const validation = err as ValidationError;
    expect(
      validation.details.some((d) => d.field.startsWith("competitors")),
    ).toBe(true);
  });

  test("スペースのみの competitor は ValidationError", async () => {
    const service = buildService();

    const err = await service
      .createExecution({
        templateId: fixtureTemplate.id,
        parameters: { competitors: ["   "] },
      })
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ValidationError);
    const validation = err as ValidationError;
    expect(
      validation.details.some((d) => d.field.startsWith("competitors")),
    ).toBe(true);
  });

  test("空文字の competitor を含むと ValidationError", async () => {
    const service = buildService();

    const err = await service
      .createExecution({
        templateId: fixtureTemplate.id,
        parameters: { competitors: ["Acme", ""] },
      })
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ValidationError);
    const validation = err as ValidationError;
    expect(
      validation.details.some((d) => d.field.startsWith("competitors")),
    ).toBe(true);
  });

  test("reference が 10000 文字（境界 OK）は通る", async () => {
    const service = buildService();

    const res = await service.createExecution({
      templateId: fixtureTemplate.id,
      parameters: {
        competitors: ["Acme"],
        reference: "x".repeat(10000),
      },
    });

    expect(res.id).toBe("exec-1");
  });

  test("reference が 10001 文字（境界 NG）なら ValidationError", async () => {
    const service = buildService();

    const err = await service
      .createExecution({
        templateId: fixtureTemplate.id,
        parameters: {
          competitors: ["Acme"],
          reference: "x".repeat(10001),
        },
      })
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ValidationError);
    const validation = err as ValidationError;
    expect(validation.details.some((d) => d.field === "reference")).toBe(true);
  });

  test("バリデーションが先で Template 不在より優先する", async () => {
    const service = buildService({ getTemplateById: async () => null });

    const err = await service
      .createExecution({
        templateId: "tpl-missing",
        parameters: { competitors: [] },
      })
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ValidationError);
  });

  test("Repo の例外は透過させる", async () => {
    const service = buildService({
      createExecution: async () => {
        throw new Error("DB connection failed");
      },
    });

    await expect(
      service.createExecution({
        templateId: fixtureTemplate.id,
        parameters: validParameters,
      }),
    ).rejects.toThrow("DB connection failed");
  });

  test("Template.definition.agents が空配列なら repo 到達前に Error をthrow する", async () => {
    const emptyAgentsTemplate = {
      ...fixtureTemplate,
      definition: { ...fixtureTemplate.definition, agents: [] },
    };
    let repoCalled = false;
    const service = buildService({
      getTemplateById: async () => emptyAgentsTemplate,
      createExecution: async () => {
        repoCalled = true;
        return {
          id: "exec-1",
          status: "pending",
          createdAt: "2026-05-04T00:00:00.000Z",
        };
      },
    });

    await expect(
      service.createExecution({
        templateId: fixtureTemplate.id,
        parameters: validParameters,
      }),
    ).rejects.toThrow(/no agents/);
    expect(repoCalled).toBe(false);
  });
});

describe("createExecutionsService.getExecution", () => {
  test("id が存在しない場合は null を返す", async () => {
    const service = buildService({ getExecution: async () => null });

    const result = await service.getExecution("exec-missing");

    expect(result).toBeNull();
  });

  test("agentExecs あり result あり → 正しいマッピング", async () => {
    const service = buildService({
      getExecution: async () => baseExecutionRow,
      getAgentExecutionsByExecutionId: async () => [investigationAgentRow],
      getResultByExecutionId: async () => resultRow,
    });

    const result = await service.getExecution("exec-1");

    expect(result).not.toBeNull();
    expect(result?.id).toBe("exec-1");
    expect(result?.status).toBe("completed");
    expect(result?.createdAt).toBe("2026-05-04T00:00:00.000Z");
    expect(result?.agentExecutions).toHaveLength(1);
    expect(result?.agentExecutions[0]?.agentId).toBe("investigation_strategy");
    expect(result?.result?.id).toBe("result-1");
    expect(result?.result?.markdown).toBe("# レポート");
  });

  test("result が null のとき result フィールドは undefined", async () => {
    const service = buildService({
      getExecution: async () => ({ ...baseExecutionRow, status: "running" }),
      getAgentExecutionsByExecutionId: async () => [],
      getResultByExecutionId: async () => null,
    });

    const result = await service.getExecution("exec-1");

    expect(result?.result).toBeUndefined();
  });
});

describe("createExecutionsService.listExecutions", () => {
  test("空配列 → { items: [], total: 0 }", async () => {
    const service = buildService({ listExecutions: async () => [] });

    const result = await service.listExecutions();

    expect(result).toEqual({ items: [], total: 0 });
  });

  test("複数行 → createdAt が ISO 文字列", async () => {
    const row1: ExecutionRow = { ...baseExecutionRow, id: "exec-1" };
    const row2: ExecutionRow = {
      ...baseExecutionRow,
      id: "exec-2",
      createdAt: new Date("2026-05-05T00:00:00.000Z"),
    };
    const service = buildService({ listExecutions: async () => [row1, row2] });

    const result = await service.listExecutions();

    expect(result.total).toBe(2);
    expect(result.items[0]?.id).toBe("exec-1");
    expect(result.items[0]?.createdAt).toBe("2026-05-04T00:00:00.000Z");
    expect(result.items[1]?.createdAt).toBe("2026-05-05T00:00:00.000Z");
  });
});
