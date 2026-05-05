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
  // trim() してから min(1) で「スペースのみ」を弾く（UI 側で trim 済みでも
  // API 直叩き経路を防御する）。
  competitors: z.array(z.string().trim().min(1).max(100)).min(1).max(5),
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
        // 配列要素のエラーは "competitors.0" の形でドット連結し、フォーム側で
        // 要素単位に inline 表示できるようにする。
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
      // Drizzle の `tx.insert(...).values([])` は TypeError を投げるため、
      // agents 空のテンプレートは repo 到達前に明示的に弾く（500 経路へ）。
      if (agents.length === 0) {
        throw new Error(`template has no agents: ${template.id}`);
      }

      return deps.createExecution({
        templateId: template.id,
        parameters: parsed.data,
        agents,
      });
    },
  };
}
