// Issue #81 Spike: hono/bun の upgradeWebSocket を最小構成で起動。
// 検証ポイント:
//   1. /ws?executionId=<id> でハンドシェイクが成立する
//   2. 不正な executionId に対し close(4404) で切断できる
//   3. サーバから push が可能 (擬似 AgentEvent を 5 件送信)
//   4. クライアント切断時に onClose が発火する

import type { ServerWebSocket } from "bun";
import { Hono } from "hono";
import { createBunWebSocket } from "hono/bun";

const { upgradeWebSocket, websocket } = createBunWebSocket<ServerWebSocket>();

const app = new Hono();

app.get("/health", (c) => c.json({ status: "ok" }));

app.get(
  "/ws",
  upgradeWebSocket((c) => {
    const executionId = c.req.query("executionId");
    let pushTimer: ReturnType<typeof setInterval> | null = null;
    return {
      onOpen(_event, ws) {
        // websocket-design.md §接続ライフサイクル: executionId が不正なら close(4404)
        if (!executionId || !/^[a-z0-9-]{1,64}$/.test(executionId)) {
          console.log("[server] reject: invalid executionId");
          ws.close(4404, "execution_not_found");
          return;
        }
        console.log(`[server] open executionId=${executionId}`);
        // 初期スナップショット: agent:status x 5 を送信
        for (const agentId of [
          "investigation:strategy",
          "investigation:product",
          "investigation:investment",
          "investigation:partnership",
          "integration:matrix",
        ]) {
          ws.send(
            JSON.stringify({
              type: "agent:status",
              agentId,
              status: "pending",
              timestamp: new Date().toISOString(),
            }),
          );
        }
        // 擬似的な AgentEvent push (200ms 間隔で 5 件 → 完了通知)
        let count = 0;
        pushTimer = setInterval(() => {
          count += 1;
          if (count <= 5) {
            ws.send(
              JSON.stringify({
                type: "agent:output",
                agentId: "investigation:strategy",
                chunk: `chunk-${count} `,
              }),
            );
          } else {
            ws.send(
              JSON.stringify({
                type: "execution:completed",
                executionId,
                resultId: "result-spike-1",
              }),
            );
            ws.close(1000, "normal");
            // onClose でも clearInterval するが、正常終了パスでは setInterval コールバック内で
            // 即時解放しておくことで「次の tick で push を試みて失敗する」状態を避ける
            if (pushTimer) clearInterval(pushTimer);
          }
        }, 200);
      },
      onMessage(event, _ws) {
        console.log(`[server] message: ${event.data}`);
      },
      onClose(event, _ws) {
        console.log(
          `[server] close code=${event.code} reason="${event.reason}"`,
        );
        if (pushTimer) clearInterval(pushTimer);
      },
    };
  }),
);

const port = Number.parseInt(process.env.PORT ?? "", 10) || 3100;
console.log(`[server] listening on http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch,
  websocket,
};
