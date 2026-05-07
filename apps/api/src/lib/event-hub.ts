/**
 * Execution ごとの AgentEvent 配信ハブ（プロセス内 pub/sub）。
 *
 * engine の `onEvent` コールバックが publish し、WS ルートが subscribe する。
 * MVP ではシングルプロセス前提のためインメモリで十分（ADR-0005）。
 * 複数インスタンス対応が必要になった時点で Redis Pub/Sub 等に差し替える。
 */

import type { AgentEvent } from "@agent-team-studio/agent-core";

type EventHandler = (event: AgentEvent) => void;

export function createEventHub() {
  const hub = new Map<string, Set<EventHandler>>();

  return {
    publish(executionId: string, event: AgentEvent): void {
      for (const h of hub.get(executionId) ?? []) h(event);
    },
    /**
     * 指定 execution の AgentEvent を受け取るハンドラを登録し、解除関数を返す。
     * WS 切断時に解除関数を呼ぶこと。
     */
    subscribe(executionId: string, handler: EventHandler): () => void {
      if (!hub.has(executionId)) hub.set(executionId, new Set());
      // biome-ignore lint/style/noNonNullAssertion: 直前の set で保証済み
      hub.get(executionId)!.add(handler);
      return () => {
        const set = hub.get(executionId);
        if (!set) return;
        set.delete(handler);
        if (set.size === 0) hub.delete(executionId);
      };
    },
  };
}
