import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres";
import { sql } from "drizzle-orm";

/**
 * Lets an admin paste a squad directly (one team per line: "Team Name: Player1 (c), Player2
 * (wk), ...") instead of pointing at a URL. Added after discovering ESPN blocks server-side
 * fetches of its own story pages (confirmed live — a plain fetch of a story URL that renders
 * fine in a browser came back completely empty), which made the story-URL fallback unreliable
 * even for a correctly-curated link. See lib/cricket/squads/manual-entry.ts.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "tour_sync_state"
      ADD COLUMN IF NOT EXISTS "manual_squad_text" text;
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "tour_sync_state"
      DROP COLUMN IF EXISTS "manual_squad_text";
  `);
}
