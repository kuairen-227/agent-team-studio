/**
 * apps/api の構造化ロガー（Pino）。
 *
 * 出力は JSON を stdout へ。ログレベルは `LOG_LEVEL`（既定 info、テスト時 silent）で制御する。
 * request 単位の相関は app.ts で request-id を child binding して用いる。
 * `err` キーは pino のデフォルトシリアライザ（pino-std-serializers）で
 * `{ type, message, stack }` に展開されるため、明示的なシリアライザ設定は不要。
 * 選定根拠・運用方針は ADR-0033 / docs/design/logging.md を SSoT とする。
 */

import type { RequestIdVariables } from "hono/request-id";
import { type LevelWithSilent, pino } from "pino";

/**
 * ログレベルを解決する。明示の `LOG_LEVEL` が最優先。
 * テスト実行（`NODE_ENV=test`）ではログ出力でテスト結果を汚さないよう silent を既定にする。
 */
export function resolveLevel(): LevelWithSilent {
  // 空文字は falsy のため未指定と同じ扱い（NODE_ENV フォールバックに落ちる）。
  if (process.env.LOG_LEVEL) {
    // LOG_LEVEL は任意文字列のため型表明できない。無効値は pino の
    // インスタンス生成時（`pino({...})` 呼び出し時）に検知される。
    return process.env.LOG_LEVEL as LevelWithSilent;
  }
  return process.env.NODE_ENV === "test" ? "silent" : "info";
}

/**
 * プロセス共通のベースロガー。
 *
 * pino-pretty は in-process transport（worker thread）として使わない（Bun での不安定さを避けるため）。
 * 開発時の整形は `bun run dev | pino-pretty` のパイプで行う（ADR-0033）。
 */
export const logger = pino({
  level: resolveLevel(),
  // 機密フィールドをログ出力から除外する。req.headers 配下の認証情報と、
  // 機密フィールド名（apiKey/api_key/token/password）をトップレベルと 1 階層下で censor する。
  // pino の `*` は単一階層ワイルドカードで再帰 `**` は非対応のため、トップレベルと
  // `*.<field>` を併記する。任意深度はカバーしないため、深くネストしたオブジェクト
  // （LLM レスポンス等）はそのまま渡さず、ログ前に機密フィールドを除去すること
  // （詳細は docs/design/logging.md）。
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "apiKey",
      "*.apiKey",
      "api_key",
      "*.api_key",
      "token",
      "*.token",
      "password",
      "*.password",
    ],
    censor: "[REDACTED]",
  },
});

export type Logger = typeof logger;

/** Hono app の Variables 型。request-id middleware と request-scoped child logger を載せる。 */
export type AppEnv = {
  Variables: RequestIdVariables & {
    /** request-id を bind した request-scoped child logger。 */
    logger: Logger;
  };
};
