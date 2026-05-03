/**
 * `/ws?executionId=stub` ルート。
 *
 * Walking Skeleton (Issue #82) のスコープ:
 * - 接続時に `agent:status pending` を 1 件だけ送信する
 * - executionId のバリデーション（`/^[a-z0-9-]{1,64}$/` 等）と close(4404) は MVP US-1〜
 *   で実装する（本 Issue では `executionId=stub` 固定のため不要）
 * - サーバ push のループ・AbortController 統一は agent-core 実装 Issue で扱う
 *
 * Spike (Issue #81) で確認済みの設計前提:
 * - hono/bun の `upgradeWebSocket` は `onOpen` の `ws` 引数経由で push 可能
 * - `onClose` でリソース解放を行う（本ルートでは push 用タイマを持たないため最小限）
 */

import type { AgentStatusPendingMessage } from "@agent-team-studio/shared";
import { Hono } from "hono";
import { upgradeWebSocket } from "../lib/ws.ts";

export function createWsRoutes() {
  const app = new Hono();

  app.get(
    "/",
    upgradeWebSocket(() => ({
      onOpen(_event, ws) {
        const message: AgentStatusPendingMessage = {
          type: "agent:status",
          agentId: "investigation:strategy",
          status: "pending",
        };
        ws.send(JSON.stringify(message));
      },
    })),
  );

  return app;
}
