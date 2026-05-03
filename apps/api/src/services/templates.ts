/**
 * テンプレート Service 層。
 *
 * Service の責務は「Repo の戻り値を API レスポンス形（`TemplateSummary[]`）へ整える」。
 * MVP では Repo の戻り値が既に `TemplateSummary[]` 型なので変換は不要だが、
 * 後続の filtering / sorting / 派生フィールド付与の入り口として層を残す。
 *
 * 依存は関数注入（`deps.listTemplateSummaries`）にして、単体テストで Repo を
 * モック差し替えできるようにする。
 */

import type { TemplateSummary } from "@agent-team-studio/shared";

export type TemplatesService = {
  listTemplates: () => Promise<TemplateSummary[]>;
};

export type TemplatesServiceDeps = {
  listTemplateSummaries: () => Promise<TemplateSummary[]>;
};

export function createTemplatesService(
  deps: TemplatesServiceDeps,
): TemplatesService {
  return {
    listTemplates: () => deps.listTemplateSummaries(),
  };
}
