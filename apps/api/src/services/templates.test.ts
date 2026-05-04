import { describe, expect, test } from "bun:test";
import type { Template, TemplateSummary } from "@agent-team-studio/shared";
import { NotFoundError } from "../lib/errors.ts";
import {
  createTemplatesService,
  type TemplatesServiceDeps,
} from "./templates.ts";

const fixtureTemplate: Template = {
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
  updated_at: "2026-05-01T00:00:00.000Z",
};

const buildService = (overrides: Partial<TemplatesServiceDeps> = {}) =>
  createTemplatesService({
    listTemplateSummaries: async () => [],
    getTemplateById: async () => null,
    ...overrides,
  });

describe("createTemplatesService", () => {
  describe("listTemplates", () => {
    test("Repo の戻り値をそのまま返す", async () => {
      const repoTemplates: TemplateSummary[] = [
        {
          id: "tpl-1",
          name: "競合調査",
          description: "MVP 唯一のテンプレート",
        },
      ];
      const service = buildService({
        listTemplateSummaries: async () => repoTemplates,
      });

      expect(await service.listTemplates()).toEqual(repoTemplates);
    });

    test("空配列もそのまま返す（empty 状態を service が握りつぶさない）", async () => {
      const service = buildService();
      expect(await service.listTemplates()).toEqual([]);
    });

    // Repo の例外を握りつぶさないことのリグレッション保険。
    // 誤って try/catch が挟まれると route 層の 500 ハンドリング（onError 経由）が効かなくなる。
    test("Repo が例外を投げると service は透過させる", async () => {
      const service = buildService({
        listTemplateSummaries: async () => {
          throw new Error("DB connection failed");
        },
      });

      await expect(service.listTemplates()).rejects.toThrow(
        "DB connection failed",
      );
    });
  });

  describe("getTemplate", () => {
    test("Repo が Template を返したらそのまま返す", async () => {
      const service = buildService({
        getTemplateById: async () => fixtureTemplate,
      });

      expect(await service.getTemplate("tpl-1")).toEqual(fixtureTemplate);
    });

    test("Repo が null を返したら NotFoundError を throw する", async () => {
      const service = buildService({
        getTemplateById: async () => null,
      });

      await expect(service.getTemplate("tpl-missing")).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });

    test("NotFoundError の resource / id がリソース種別と引数 id を保持する", async () => {
      const service = buildService({ getTemplateById: async () => null });

      try {
        await service.getTemplate("tpl-missing");
        throw new Error("expected NotFoundError");
      } catch (err) {
        expect(err).toBeInstanceOf(NotFoundError);
        const e = err as NotFoundError;
        expect(e.resource).toBe("template");
        expect(e.id).toBe("tpl-missing");
      }
    });

    test("Repo の例外は透過させる（DB 例外は 500 経路へ）", async () => {
      const service = buildService({
        getTemplateById: async () => {
          throw new Error("DB connection failed");
        },
      });

      await expect(service.getTemplate("tpl-1")).rejects.toThrow(
        "DB connection failed",
      );
    });
  });
});
