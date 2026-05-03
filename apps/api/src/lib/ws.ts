/**
 * `hono/bun` の WebSocket ヘルパをモジュールレベルで初期化。
 *
 * `createBunWebSocket` の戻り値 `websocket` は Bun の serve に渡す必要があるため、
 * route ファイルから export 元を 1 箇所に固定して取り出せるようにする。
 *
 * Spike (Issue #81 / PR #113) で `upgradeWebSocket` の動作（ハンドシェイク・push・onClose）
 * を確認済み。Walking Skeleton では最小限の利用に留める。
 */

import type { ServerWebSocket } from "bun";
import { createBunWebSocket } from "hono/bun";

export const { upgradeWebSocket, websocket } =
  createBunWebSocket<ServerWebSocket>();
