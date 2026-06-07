/**
 * 失敗 reason をユーザー向けメッセージ（種別ラベル + 次のアクション案内）へ写像する。
 *
 * エラー画面に種別と次のアクションを提示するための表示文言の SSoT。
 * バックエンドの分類（{@link AgentFailReason} / {@link ExecutionFailReason}）を
 * そのまま流用し、画面表示の文言だけをここに集約する。
 * 技術的な詳細（生出力・エラーコード）は呼び出し側が折りたたみ/副次情報として扱う。
 */

import type {
  AgentFailReason,
  ExecutionFailReason,
} from "@agent-team-studio/shared";

/** 失敗時のユーザー向け表示。`label`=種別名、`guidance`=次のアクション案内。 */
export type FailureMessage = {
  label: string;
  guidance: string;
};

const AGENT_FAILURE_MESSAGES: Record<AgentFailReason, FailureMessage> = {
  llm_error: {
    label: "LLM プロバイダーエラー",
    guidance:
      "AI モデルとの通信に失敗しました。時間をおいて再度実行してください。繰り返す場合はモデルや API キーの設定を確認してください。",
  },
  output_parse_error: {
    label: "出力解析エラー",
    guidance:
      "AI の応答を解釈できませんでした。再実行で解消する場合があります。",
  },
  timeout: {
    label: "タイムアウト",
    guidance:
      "応答に時間がかかり処理を中断しました。時間をおいて再度実行してください。",
  },
  internal_error: {
    label: "内部エラー",
    guidance:
      "予期しないエラーが発生しました。時間をおいて再度実行してください。",
  },
};

const EXECUTION_FAILURE_MESSAGES: Record<ExecutionFailReason, FailureMessage> =
  {
    all_investigations_failed: {
      label: "すべての調査エージェントが失敗しました",
      guidance:
        "調査を完了できませんでした。各エージェントの失敗理由を確認のうえ、時間をおいて再度実行してください。",
    },
    integration_failed: {
      label: "統合エージェントが失敗しました",
      guidance:
        "調査結果の統合に失敗しました。調査エージェントの出力を確認のうえ、再度実行してください。",
    },
    timeout: {
      label: "実行がタイムアウトしました",
      guidance:
        "実行全体が時間内に完了しませんでした。時間をおいて再度実行してください。",
    },
    internal_error: {
      label: "内部エラーが発生しました",
      guidance:
        "予期しないエラーが発生しました。時間をおいて再度実行してください。",
    },
  };

/** エージェント単位の失敗 reason を表示用メッセージへ変換する。 */
export function describeAgentFailure(reason: AgentFailReason): FailureMessage {
  return AGENT_FAILURE_MESSAGES[reason];
}

/** 実行単位の失敗 reason を表示用メッセージへ変換する。 */
export function describeExecutionFailure(
  reason: ExecutionFailReason,
): FailureMessage {
  return EXECUTION_FAILURE_MESSAGES[reason];
}
