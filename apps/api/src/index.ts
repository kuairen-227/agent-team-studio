/**
 * apps/api のエントリポイント。
 *
 * 本番起動: DATABASE_URL から DB クライアントを起こし、repo 関数を `createApp` に注入する。
 * 統合テストは `createApp` を直接呼ぶ（DB を立ち上げず repo をモックする）。
 *
 * Bun の serve には `fetch` と `websocket` の双方を渡す必要がある（hono/bun の規約）。
 */

import {
  createDbClient,
  getTemplateById,
  listTemplateSummaries,
} from "@agent-team-studio/db";
import { createApp } from "./app.ts";
import { websocket } from "./lib/ws.ts";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}

const { db } = createDbClient(databaseUrl);

const app = createApp({
  listTemplateSummaries: () => listTemplateSummaries(db),
  getTemplateById: (id) => getTemplateById(db, id),
});

const port = Number.parseInt(process.env.PORT ?? "", 10) || 3000;

export default {
  port,
  fetch: app.fetch,
  websocket,
};
