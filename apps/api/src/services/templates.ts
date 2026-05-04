/**
 * テンプレート Service 層。
 *
 * Service の責務は「Repo の戻り値を API レスポンス形へ整える」ことと
 * 「不在を `NotFoundError` として表す」こと。
 *
 * - listTemplates: `TemplateSummary[]` を返す（MVP では変換なし）
 * - getTemplate: `Template` を返す。不在時は NotFoundError を throw（route で 404 へ）
 *
 * 依存は関数注入（`deps.*`）にして、単体テストで Repo をモック差し替えできるようにする。
 */

import type { Template, TemplateSummary } from "@agent-team-studio/shared";
import { NotFoundError } from "../lib/errors.ts";

export type TemplatesService = {
  listTemplates: () => Promise<TemplateSummary[]>;
  getTemplate: (id: string) => Promise<Template>;
};

export type TemplatesServiceDeps = {
  listTemplateSummaries: () => Promise<TemplateSummary[]>;
  getTemplateById: (id: string) => Promise<Template | null>;
};

export function createTemplatesService(
  deps: TemplatesServiceDeps,
): TemplatesService {
  return {
    listTemplates: () => deps.listTemplateSummaries(),
    async getTemplate(id) {
      const template = await deps.getTemplateById(id);
      if (!template) throw new NotFoundError("template", id);
      return template;
    },
  };
}
