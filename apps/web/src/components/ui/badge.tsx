/**
 * エージェントステータス表示用 Badge コンポーネント。
 *
 * ui-patterns.md §5 §6.1 のステータスバッジ仕様に準拠。
 * variant は AgentStatus / ExecutionStatus の 4 状態に対応する。
 */

import type { AgentStatus, ExecutionStatus } from "@agent-team-studio/shared";
import { cn } from "@/lib/utils";

// AgentStatus / ExecutionStatus は MVP 時点で値が一致するが将来分岐の余地を
// 残すため別型扱い（domain-types.ts のコメント参照）。`satisfies` で両者を
// 同時に網羅できるように制約する — どちらかが値を増やせばここで型エラーになる。
type BadgeVariant = "pending" | "running" | "completed" | "failed";

const VARIANT_CLASSES = {
  pending: "bg-muted text-muted-foreground",
  running: "bg-blue-100 text-blue-900",
  completed: "bg-green-100 text-green-900",
  failed: "bg-red-100 text-red-900",
} satisfies Record<AgentStatus | ExecutionStatus, string>;

const VARIANT_LABELS = {
  pending: "待機",
  running: "実行中",
  completed: "完了",
  failed: "失敗",
} satisfies Record<AgentStatus | ExecutionStatus, string>;

type BadgeProps = {
  variant: BadgeVariant;
  /**
   * 値が時間とともに更新される文脈で true（既定）。履歴一覧など静的表示では
   * false にして role="status" の暗黙的 aria-live=polite を抑制する。
   */
  live?: boolean;
  className?: string;
};

export function Badge({ variant, live = true, className }: BadgeProps) {
  return (
    <span
      role={live ? "status" : undefined}
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        VARIANT_CLASSES[variant],
        className,
      )}
    >
      {VARIANT_LABELS[variant]}
    </span>
  );
}
