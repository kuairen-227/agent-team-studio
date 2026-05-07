/**
 * エージェントステータス表示用 Badge コンポーネント。
 *
 * ui-patterns.md §5 §6.1 のステータスバッジ仕様に準拠。
 * variant は AgentStatus / ExecutionStatus の 4 状態に対応する。
 */

import { cn } from "@/lib/utils";

type BadgeVariant = "pending" | "running" | "completed" | "failed";

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  pending: "bg-muted text-muted-foreground",
  running: "bg-blue-100 text-blue-900",
  completed: "bg-green-100 text-green-900",
  failed: "bg-red-100 text-red-900",
};

const VARIANT_LABELS: Record<BadgeVariant, string> = {
  pending: "待機",
  running: "実行中",
  completed: "完了",
  failed: "失敗",
};

type BadgeProps = {
  variant: BadgeVariant;
  className?: string;
};

export function Badge({ variant, className }: BadgeProps) {
  return (
    <span
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
