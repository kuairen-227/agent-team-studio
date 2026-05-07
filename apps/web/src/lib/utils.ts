import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** `clsx` と `tailwind-merge` を組み合わせた Tailwind CSS クラス結合ユーティリティ。 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
