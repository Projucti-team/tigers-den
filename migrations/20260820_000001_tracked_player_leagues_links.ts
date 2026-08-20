import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres";
import { sql } from "drizzle-orm";

/**
 * Redesigns tracked_player_leagues so the admin only ever pastes two ESPNcricinfo links --
 * the player's profile and the team's profile -- instead of hand-typing a display name, a
 * league name, and hunting down the numeric ESPN Core league id (there was never any easy way
 * for an admin to find that id). Confirmed live against ESPN's Core API: the trailing number in
 * both cricinfo URL patterns (espncricinfo.com/cricketers/{slug}-{id}, espncricinfo.com/team/{slug}-{id})
 * IS the Core API athlete/team id directly, and a team object exposes its current/default league
 * ref -- so the sync job can resolve everything else (names, current league) automatically.
 * Table is empty in production (no tracked players configured yet), so this is a safe in-place
 * redesign rather than a data migration.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "tracked_player_leagues"
      ADD COLUMN IF NOT EXISTS "player_cricinfo_url" varchar,
      ADD COLUMN IF NOT EXISTS "team_cricinfo_url" varchar,
      ADD COLUMN IF NOT EXISTS "athlete_id" integer,
      ADD COLUMN IF NOT EXISTS "team_id" integer,
      ADD COLUMN IF NOT EXISTS "last_resolved_at" timestamp(3) with time zone;
  `);

  await db.execute(sql`
    ALTER TABLE "tracked_player_leagues"
      ALTER COLUMN "player_name" DROP NOT NULL,
      ALTER COLUMN "team_name" DROP NOT NULL,
      ALTER COLUMN "league_name" DROP NOT NULL,
      ALTER COLUMN "espn_league_id" DROP NOT NULL;
  `);

  await db.execute(sql`
    ALTER TABLE "tracked_player_leagues"
      DROP COLUMN IF EXISTS "cricinfo_series_id",
      DROP COLUMN IF EXISTS "season_year",
      DROP COLUMN IF EXISTS "use_season_events";
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "tracked_player_leagues"
      ADD COLUMN IF NOT EXISTS "cricinfo_series_id" numeric,
      ADD COLUMN IF NOT EXISTS "season_year" numeric,
      ADD COLUMN IF NOT EXISTS "use_season_events" boolean DEFAULT true;
  `);

  await db.execute(sql`
    ALTER TABLE "tracked_player_leagues"
      ALTER COLUMN "player_name" SET NOT NULL,
      ALTER COLUMN "team_name" SET NOT NULL,
      ALTER COLUMN "league_name" SET NOT NULL,
      ALTER COLUMN "espn_league_id" SET NOT NULL;
  `);

  await db.execute(sql`
    ALTER TABLE "tracked_player_leagues"
      DROP COLUMN IF EXISTS "player_cricinfo_url",
      DROP COLUMN IF EXISTS "team_cricinfo_url",
      DROP COLUMN IF EXISTS "athlete_id",
      DROP COLUMN IF EXISTS "team_id",
      DROP COLUMN IF EXISTS "last_resolved_at";
  `);
}
