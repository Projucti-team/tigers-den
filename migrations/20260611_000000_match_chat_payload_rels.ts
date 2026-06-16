import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres";
import { sql } from "drizzle-orm";

/**
 * Payload locked-document rels need a column per collection.
 * Match chat tables were added in 20260610 without these rels columns.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN IF NOT EXISTS "stand_discussions_id" integer,
      ADD COLUMN IF NOT EXISTS "chants_id" integer,
      ADD COLUMN IF NOT EXISTS "stand_reactions_id" integer,
      ADD COLUMN IF NOT EXISTS "stand_comments_id" integer,
      ADD COLUMN IF NOT EXISTS "match_chat_rooms_id" integer,
      ADD COLUMN IF NOT EXISTS "match_chat_messages_id" integer;
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels"
      DROP COLUMN IF EXISTS "match_chat_messages_id",
      DROP COLUMN IF EXISTS "match_chat_rooms_id",
      DROP COLUMN IF EXISTS "stand_comments_id",
      DROP COLUMN IF EXISTS "stand_reactions_id",
      DROP COLUMN IF EXISTS "chants_id",
      DROP COLUMN IF EXISTS "stand_discussions_id";
  `);
}
