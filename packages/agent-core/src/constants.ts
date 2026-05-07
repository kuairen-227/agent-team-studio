/**
 * agent-core のタイムアウト値 SSoT。
 *
 * docs/design/agent-execution.md §7 の値を転記。実装後は本ファイルが SSoT となる。
 * Template 単位でのカスタマイズは v2 以降（MVP ではすべてのエージェントで共通値を使用）。
 */

/** エージェント単位のタイムアウト（ms）。超過時は AbortSignal で LLM 呼び出しを中断する。 */
export const AGENT_TIMEOUT_MS = 300_000;

/** Execution 全体のタイムアウト（ms）。超過時はすべての実行中エージェントを中断する。 */
export const EXECUTION_TIMEOUT_MS = 1_500_000;
