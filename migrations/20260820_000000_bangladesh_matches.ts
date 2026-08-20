import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres";
import { sql } from "drizzle-orm";

/**
 * Replaces the old data/bangladesh-last-match.json + data/bangladesh-upcoming-matches.json
 * snapshot files (each holding a single cached blob, silently left stale whenever the ESPN scan
 * behind them found nothing new — see the last-match staleness bug) with one real table covering
 * every Bangladesh team: men, women, under-19, and emerging/A. Each row is one match, upserted by
 * match_id on every sync run, so "what's the last result / what's live / what's next" is a plain
 * SQL query instead of a brittle single-blob cache that requires someone to hand-curate which
 * ESPN league ids exist.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "bangladesh_matches" (
      "id" serial PRIMARY KEY NOT NULL,
      "match_id" varchar NOT NULL UNIQUE,
      "team_category" varchar NOT NULL CHECK ("team_category" IN ('men', 'women', 'u19', 'emerging')),
      "match_type" varchar,
      "status" varchar NOT NULL CHECK ("status" IN ('live', 'completed', 'upcoming')),
      "status_text" varchar,
      "teams" jsonb,
      "opponent" varchar,
      "score_summary" varchar,
      "venue" varchar,
      "match_date" timestamp(3) with time zone,
      "series_id" varchar,
      "series_name" varchar,
      "espn_league_id" integer,
      "espn_event_id" varchar,
      "source" varchar NOT NULL DEFAULT 'cricapi',
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "idx_bangladesh_matches_status" ON "bangladesh_matches" ("status");
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "idx_bangladesh_matches_category" ON "bangladesh_matches" ("team_category");
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "idx_bangladesh_matches_date" ON "bangladesh_matches" ("match_date");
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP TABLE IF EXISTS "bangladesh_matches"`);
}
