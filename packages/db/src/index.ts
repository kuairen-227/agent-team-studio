/**
 * @agent-team-studio/db のエントリポイント。
 *
 * - schema: 全テーブル・enum 定数・行型
 * - client: DB 接続（drizzle インスタンス）
 * - repositories: 読み書き責務の薄いラッパ。Service 層が直接 schema を触らないための境界
 */

export { createDbClient, type DbClient, type DrizzleDb } from "./client.ts";
export * from "./repositories/agent-executions.ts";
export * from "./repositories/executions.ts";
export * from "./repositories/results.ts";
export * from "./repositories/templates.ts";
export * as schema from "./schema/index.ts";
