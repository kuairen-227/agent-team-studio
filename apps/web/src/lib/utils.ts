/**
 * Tailwind CSS クラス結合ユーティリティ（shadcn/ui が生成するボイラープレート）。
 *
 * `tailwind-merge` で競合するクラスを解決し、`clsx` で条件分岐を扱う。
 */

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** `clsx` と `tailwind-merge` を組み合わせた Tailwind CSS クラス結合ユーティリティ。 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
