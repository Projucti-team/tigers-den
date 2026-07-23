import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres";
import { sql } from "drizzle-orm";

/**
 * Lets an admin pin one or more specific ESPNcricinfo story URLs to use as squad sources for
 * a tour, for when ESPN's structured Core API data (team athletes / match rosters) isn't
 * populated yet and our RSS-based squad-announcement discovery misses the story (too narrow
 * a headline match, or the story has already scrolled out of the sitewide "latest" feed).
 * Stored as newline-separated text — split into an array in application code.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "tour_sync_state"
      ADD COLUMN IF NOT EXISTS "squad_story_url" text;
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "tour_sync_state"
      DROP COLUMN IF EXISTS "squad_story_url";
  `);
}
