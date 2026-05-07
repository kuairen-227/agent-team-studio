/**
 * Result の INSERT リポジトリ。
 *
 * Integration Agent 完了後にエンジンから呼び出される。
 * Execution との 1:0..1 制約は DB の UNIQUE 制約で施行する（data-model.md §3）。
 */

import type { CompetitorAnalysisResult } from "@agent-team-studio/shared";
import type { DrizzleDb } from "../client.ts";
import { results } from "../schema/index.ts";

/** `insertResult` の入力型。 */
export type InsertResultInput = {
  executionId: string;
  markdown: string;
  structured: CompetitorAnalysisResult;
};

/**
 * Result を INSERT し、生成された ID を返す。
 *
 * エンジンは返された resultId を `execution_completed` イベントに含める。
 */
export async function insertResult(
  db: DrizzleDb,
  input: InsertResultInput,
): Promise<string> {
  const [result] = await db
    .insert(results)
    .values({
      executionId: input.executionId,
      markdown: input.markdown,
      structured: input.structured,
    })
    .returning({ id: results.id });
  if (!result) throw new Error("failed to insert result");
  return result.id;
}
