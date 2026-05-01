/**
 * @agent-team-studio/db のエントリポイント。
 *
 * - schema: 全テーブル・enum 定数・行型
 * - client: DB 接続（drizzle インスタンス）
 */

export { createDbClient, type DbClient } from "./client.ts";
export * as schema from "./schema/index.ts";
