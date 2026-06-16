import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres";
import { sql } from "drizzle-orm";

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "countries" (
      "id" serial PRIMARY KEY NOT NULL,
      "slug" varchar NOT NULL,
      "name" varchar NOT NULL,
      "short_name" varchar,
      "espn_team_id" numeric,
      "icc_team_name" varchar,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
  `);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "countries_slug_idx"
    ON "countries" USING btree ("slug");
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "players" (
      "id" serial PRIMARY KEY NOT NULL,
      "lookup_key" varchar NOT NULL,
      "display_name" varchar NOT NULL,
      "country_id" integer NOT NULL,
      "profile_url" varchar,
      "image_url" varchar,
      "icc_player_id" numeric,
      "cricinfo_player_id" numeric,
      "last_resolved_at" timestamp(3) with time zone,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
  `);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "players_lookup_key_idx"
    ON "players" USING btree ("lookup_key");
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "players_display_name_idx"
    ON "players" USING btree ("display_name");
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "players_country_idx"
    ON "players" USING btree ("country_id");
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "players_icc_player_id_idx"
    ON "players" USING btree ("icc_player_id");
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "players_cricinfo_player_id_idx"
    ON "players" USING btree ("cricinfo_player_id");
  `);

  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN IF NOT EXISTS "countries_id" integer,
      ADD COLUMN IF NOT EXISTS "players_id" integer;
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels"
      DROP COLUMN IF EXISTS "players_id",
      DROP COLUMN IF EXISTS "countries_id";
  `);
  await db.execute(sql`DROP TABLE IF EXISTS "players"`);
  await db.execute(sql`DROP TABLE IF EXISTS "countries"`);
}
