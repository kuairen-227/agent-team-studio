/**
 * `templates` テーブル: テンプレート定義の永続化。
 *
 * SSoT: docs/design/data-model.md §4.1
 * - 論理モデル（属性・意味論）は data-model.md
 * - 命名規約・ID 形式は packages/db/README.md
 *
 * 物理スキーマの判断:
 * - id: UUIDv7（Postgres 18 ネイティブの uuidv7() で生成。時系列ソート可）
 * - definition: jsonb（TemplateDefinition 型）。キー検索/部分更新は当面しない想定
 * - timestamps: timestamptz（タイムゾーン付き）+ DB 既定値で生成
 *
 * updated_at の更新方針（MVP ではアプリ側で明示更新する）:
 * MVP は templates をシード専用とし、ユーザーによるテンプレート編集は v2 以降の Non-goal
 * （ADR-0005）。そのため UPDATE 時の自動更新トリガーは設けない。v2 でテンプレート編集を
 * 実装する際に、以下のいずれかを選択する: (a) BEFORE UPDATE トリガーで自動更新、
 * (b) アプリ側で UPDATE 時に updatedAt = now() を明示セット。実装時に再判断する。
 */

import type { TemplateDefinition } from "@agent-team-studio/shared";
import { sql } from "drizzle-orm";
import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const templates = pgTable("templates", {
  id: uuid("id").primaryKey().default(sql`uuidv7()`),
  name: text("name").notNull(),
  description: text("description").notNull(),
  // jsonb<T>() で TS 側に型を伝搬する（DB 側は jsonb のまま）。
  definition: jsonb("definition").$type<TemplateDefinition>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type TemplateRow = typeof templates.$inferSelect;
export type NewTemplateRow = typeof templates.$inferInsert;
