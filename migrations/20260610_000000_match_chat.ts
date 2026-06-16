import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres";
import { sql } from "drizzle-orm";

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "match_chat_rooms" (
      "id" serial PRIMARY KEY NOT NULL,
      "match_id" varchar NOT NULL,
      "title" varchar NOT NULL,
      "ended_at" timestamp(3) with time zone,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
  `);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "match_chat_rooms_match_id_idx"
    ON "match_chat_rooms" USING btree ("match_id");
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "match_chat_messages" (
      "id" serial PRIMARY KEY NOT NULL,
      "match_id" varchar NOT NULL,
      "author_id" integer NOT NULL,
      "body" varchar NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "match_chat_messages_match_id_idx"
    ON "match_chat_messages" USING btree ("match_id");
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "match_chat_messages_match_created_idx"
    ON "match_chat_messages" USING btree ("match_id", "created_at");
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP TABLE IF EXISTS "match_chat_messages"`);
  await db.execute(sql`DROP TABLE IF EXISTS "match_chat_rooms"`);
}
