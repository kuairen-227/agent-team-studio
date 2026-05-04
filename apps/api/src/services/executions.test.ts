import { describe, expect, test } from "bun:test";
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

const buildService = (overrides: Partial<ExecutionsServiceDeps> = {}) =>
  createExecutionsService({
    getTemplateById: async () => fixtureTemplate,
    createExecution: async () => ({
      id: "exec-1",
      status: "pending",
      createdAt: "2026-05-04T00:00:00.000Z",
    }),
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
});
