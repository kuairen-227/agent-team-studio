/**
 * agent-core が依存するロガーの最小ポート型。
 *
 * apps→packages の逆依存（agent-core が apps/api の Pino 実装に依存すること）を避けるため、
 * 構造的インターフェースのみを定義する。Pino の `Logger` はこの形に構造互換で、
 * apps/api 側がそのまま注入できる。テストでは {@link NOOP_LOGGER} か fake を渡す。
 *
 * trace ID は呼び出し側が `child({ requestId })` で bind した logger を注入するため、
 * agent-core は ID 値を直接知らずにログへ伝搬できる（関心の分離）。
 */

/** ログに添える構造化フィールド。 */
export type LogFields = Record<string, unknown>;

/** Pino と構造互換な最小ロガーインターフェース。 */
export interface Logger {
  info(obj: LogFields, msg?: string): void;
  warn(obj: LogFields, msg?: string): void;
  error(obj: LogFields, msg?: string): void;
  debug(obj: LogFields, msg?: string): void;
  /** bindings を引き継いだ子ロガーを返す。 */
  child(bindings: LogFields): Logger;
}

/** ロガー未注入時のフォールバック。何も出力しない。 */
export const NOOP_LOGGER: Logger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
  child: () => NOOP_LOGGER,
};
