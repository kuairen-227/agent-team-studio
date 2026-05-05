/**
 * Execution 作成 Service。
 *
 * バリデーションは Template 取得より先に実行する。入力エラーは Template 存在有無に
 * 依存せず判定可能で、不要な DB アクセスを避けるため。
 *
 * MVP では parameters の型を `CompetitorAnalysisParameters` 固定とする（テンプレ横断の
 * 抽象化は v2 で導入予定）。
 */

import type { CreateExecutionInput } from "@agent-team-studio/db";
import type {
  CreateExecutionRequest,
  CreateExecutionResponse,
  Template,
} from "@agent-team-studio/shared";
import { z } from "zod";
import { NotFoundError, ValidationError } from "../lib/errors.ts";

const competitorAnalysisParametersSchema = z.object({
  competitors: z.array(z.string().min(1).max(100)).min(1).max(5),
  reference: z.string().max(10000).optional(),
});

export type ExecutionsService = {
  createExecution: (
    request: CreateExecutionRequest,
  ) => Promise<CreateExecutionResponse>;
};

export type ExecutionsServiceDeps = {
  getTemplateById: (id: string) => Promise<Template | null>;
  createExecution: (
    input: CreateExecutionInput,
  ) => Promise<CreateExecutionResponse>;
};

export function createExecutionsService(
  deps: ExecutionsServiceDeps,
): ExecutionsService {
  return {
    async createExecution(request) {
      const parsed = competitorAnalysisParametersSchema.safeParse(
        request.parameters,
      );
      if (!parsed.success) {
        // field 名は parameters のキー基準（api-design.md §エラーレスポンス 例と整合）。
        // 配列要素は "competitors.0" の形でドット連結する。
        throw new ValidationError(
          parsed.error.issues.map((issue) => ({
            field: issue.path.map(String).join("."),
            reason: issue.message,
          })),
        );
      }

      const template = await deps.getTemplateById(request.templateId);
      if (!template) {
        throw new NotFoundError("template", request.templateId);
      }

      const agents = template.definition.agents.map((a) => ({
        agentId: a.agent_id,
        role: a.role,
      }));

      return deps.createExecution({
        templateId: template.id,
        parameters: parsed.data,
        agents,
      });
    },
  };
}
