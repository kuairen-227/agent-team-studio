/// <reference types="vite/client" />

/**
 * クライアントに公開される環境変数の型定義。
 * `VITE_` 接頭辞のみ Vite がバンドルへ埋め込む（vite.config.ts 参照）。
 */
interface ImportMetaEnv {
  /** Sentry DSN（error tracking, ADR-0035）。未設定時は送信無効。build-time に埋め込まれ公開前提。 */
  readonly VITE_SENTRY_DSN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
