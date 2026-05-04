import { describe, expect, test } from "bun:test";
import {
  fixtureTemplate,
  fixtureTemplateSummaries,
} from "../_test-fixtures.ts";
import { NotFoundError } from "../lib/errors.ts";
import {
  createTemplatesService,
  type TemplatesServiceDeps,
} from "./templates.ts";

const buildService = (overrides: Partial<TemplatesServiceDeps> = {}) =>
  createTemplatesService({
    listTemplateSummaries: async () => [],
    getTemplateById: async () => null,
    ...overrides,
  });

describe("createTemplatesService", () => {
  describe("listTemplates", () => {
    test("Repo の戻り値をそのまま返す", async () => {
      const service = buildService({
        listTemplateSummaries: async () => fixtureTemplateSummaries,
      });

      expect(await service.listTemplates()).toEqual(fixtureTemplateSummaries);
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

    // catch チェーン経由で例外を取り出すことで、例外が throw されなかった場合の
    // フォールスルー（誤った Error が catch に渡る）を回避する。
    test("NotFoundError の resource / id がリソース種別と引数 id を保持する", async () => {
      const service = buildService({ getTemplateById: async () => null });

      const err = await service
        .getTemplate("tpl-missing")
        .catch((e: unknown) => e);

      expect(err).toBeInstanceOf(NotFoundError);
      const notFound = err as NotFoundError;
      expect(notFound.resource).toBe("template");
      expect(notFound.id).toBe("tpl-missing");
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
