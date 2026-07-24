import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres";
import { sql } from "drizzle-orm";

/**
 * Adds:
 * - players.photo_id — our own mirrored (or manually uploaded) copy of the player's headshot
 *   in the media collection, so the site stops hot-linking ICC/Cricinfo/CricAPI CDNs directly.
 *   See lib/cricket/players/mirror-image.ts.
 * - players_aliases — alternate name spellings that resolve to the same player record (e.g.
 *   "Mohammad" vs "Mohammed"), populated by merging duplicates in the admin panel or added by
 *   hand. See lib/cricket/players/registry.ts (findPlayerByAlias) and
 *   app/api/admin/players-merge/route.ts.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "players"
      ADD COLUMN IF NOT EXISTS "photo_id" integer;
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "players_aliases" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "name" varchar NOT NULL
    );
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP TABLE IF EXISTS "players_aliases"`);
  await db.execute(sql`
    ALTER TABLE "players"
      DROP COLUMN IF EXISTS "photo_id";
  `);
}
