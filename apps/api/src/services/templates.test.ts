import { describe, expect, test } from "bun:test";
import type { TemplateSummary } from "@agent-team-studio/shared";
import { createTemplatesService } from "./templates.ts";

describe("createTemplatesService", () => {
  test("listTemplates が Repo の戻り値をそのまま返す", async () => {
    const repoTemplates: TemplateSummary[] = [
      {
        id: "tpl-1",
        name: "競合調査",
        description: "MVP 唯一のテンプレート",
      },
    ];
    const service = createTemplatesService({
      listTemplateSummaries: async () => repoTemplates,
    });

    expect(await service.listTemplates()).toEqual(repoTemplates);
  });

  test("空配列もそのまま返す（empty 状態を service が握りつぶさない）", async () => {
    const service = createTemplatesService({
      listTemplateSummaries: async () => [],
    });

    expect(await service.listTemplates()).toEqual([]);
  });

  // Repo の例外を握りつぶさないことのリグレッション保険。
  // 現状の service は素通しなので自然に伝播するが、US-1 でロジックが入った時に
  // 誤って try/catch が挟まれてしまうと route 層の 500 ハンドリングが効かなくなる。
  test("Repo が例外を投げると service は透過させる", async () => {
    const service = createTemplatesService({
      listTemplateSummaries: async () => {
        throw new Error("DB connection failed");
      },
    });

    await expect(service.listTemplates()).rejects.toThrow(
      "DB connection failed",
    );
  });
});
