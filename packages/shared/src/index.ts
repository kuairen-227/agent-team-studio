/**
 * 型のみ利用するコンシューマーでも barrel re-export 経由で `ws-guards.ts` の
 * runtime コードが含まれる形になる。MVP では shared の利用者が限定的（apps/api,
 * apps/web, packages/db, packages/agent-core）でツリーシェイキングが効くため許容する。
 * 利用者が増えて runtime 混入が問題化した場合は `./types` / `./guards` の
 * サブパス export に分割する。
 */
export * from "./api-types.ts";
export * from "./domain-types.ts";
export * from "./ws-guards.ts";
export * from "./ws-types.ts";
