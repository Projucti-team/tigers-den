type MigrationDb = { execute: (query: unknown) => Promise<unknown> };
type MigrateUpArgs = { db: MigrationDb };
type MigrateDownArgs = { db: MigrationDb };
import { sql } from "drizzle-orm";

/**
 * Payload locked-document rels need one column per collection.
 * Older production DBs may be missing cricket_snapshots_id and/or stand/chat columns.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "cricket_snapshots" (
      "id" serial PRIMARY KEY NOT NULL,
      "key" varchar NOT NULL,
      "label" varchar NOT NULL,
      "fetched_at" timestamp(3) with time zone NOT NULL,
      "data" jsonb NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
  `);

  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "cricket_snapshots_key_idx"
    ON "cricket_snapshots" USING btree ("key");
  `);

  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN IF NOT EXISTS "users_id" integer,
      ADD COLUMN IF NOT EXISTS "members_id" integer,
      ADD COLUMN IF NOT EXISTS "member_posts_id" integer,
      ADD COLUMN IF NOT EXISTS "member_follows_id" integer,
      ADD COLUMN IF NOT EXISTS "media_id" integer,
      ADD COLUMN IF NOT EXISTS "posts_id" integer,
      ADD COLUMN IF NOT EXISTS "hero_slides_id" integer,
      ADD COLUMN IF NOT EXISTS "cricket_snapshots_id" integer,
      ADD COLUMN IF NOT EXISTS "stand_discussions_id" integer,
      ADD COLUMN IF NOT EXISTS "chants_id" integer,
      ADD COLUMN IF NOT EXISTS "stand_reactions_id" integer,
      ADD COLUMN IF NOT EXISTS "stand_comments_id" integer,
      ADD COLUMN IF NOT EXISTS "match_chat_rooms_id" integer,
      ADD COLUMN IF NOT EXISTS "match_chat_messages_id" integer;
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Intentionally empty — do not drop rel columns in production.
}
