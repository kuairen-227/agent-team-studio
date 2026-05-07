import type { AgentFailReason } from "@agent-team-studio/shared";

/** LLM API 失敗を表すカスタムエラー。`failReason` で失敗の種別を識別する。 */
export class LlmError extends Error {
  readonly failReason: AgentFailReason;

  constructor(
    failReason: AgentFailReason,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "LlmError";
    this.failReason = failReason;
  }
}
