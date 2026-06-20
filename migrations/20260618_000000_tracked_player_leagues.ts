import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres";
import { sql } from "drizzle-orm";

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "tracked_player_leagues" (
      "id" serial PRIMARY KEY NOT NULL,
      "player_name" varchar NOT NULL,
      "team_name" varchar NOT NULL,
      "league_name" varchar NOT NULL,
      "espn_league_id" numeric NOT NULL,
      "cricinfo_series_id" numeric,
      "season_year" numeric,
      "use_season_events" boolean DEFAULT true,
      "active" boolean DEFAULT true,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
  `);

  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN IF NOT EXISTS "tracked_player_leagues_id" integer;
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels"
      DROP COLUMN IF EXISTS "tracked_player_leagues_id";
  `);
  await db.execute(sql`DROP TABLE IF EXISTS "tracked_player_leagues"`);
}
