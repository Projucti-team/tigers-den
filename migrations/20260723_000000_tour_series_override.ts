import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres";
import { sql } from "drizzle-orm";

/**
 * Tracks which ESPNcricinfo series a tour's data is being pulled from, and lets an
 * admin pin a specific series id when auto-discovery matches the wrong one.
 *
 * - espn_cricinfo_series_id: last series id actually used to resolve fixtures/squads
 *   (written by the sync jobs every run — informational).
 * - espn_series_override: admin-set series id that, when present, is used instead of
 *   the auto-discovery scan.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "tour_sync_state"
      ADD COLUMN IF NOT EXISTS "espn_cricinfo_series_id" integer,
      ADD COLUMN IF NOT EXISTS "espn_league_id" integer,
      ADD COLUMN IF NOT EXISTS "espn_series_override" integer;
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "tour_sync_state"
      DROP COLUMN IF EXISTS "espn_cricinfo_series_id",
      DROP COLUMN IF EXISTS "espn_league_id",
      DROP COLUMN IF EXISTS "espn_series_override";
  `);
}
