/**
 * Zod の組み込み日本語ロケールを適用する副作用モジュール。
 * import するだけで `z.config(ja())` が実行される。
 *
 * lib/errors.ts の他エラーが日本語固定なのと整合させ、Zod のデフォルト英語メッセージが
 * `ApiValidationError.details[].reason` に漏れるのを防ぐ。
 */

import { z } from "zod";
import { ja } from "zod/locales";

z.config(ja());
