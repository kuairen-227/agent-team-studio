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
});
