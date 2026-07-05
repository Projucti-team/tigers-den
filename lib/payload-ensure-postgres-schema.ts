import { getPostgresConnectionString } from "@/lib/payload-postgres-url";

let postgresSchemaReady: Promise<void> | null = null;

/**
 * Idempotent Postgres DDL — runs on every app boot so Coolify/Docker never miss a rel column
 * (deploy:migrate uses tsx and is not available in the production container).
 */
export function ensurePostgresPayloadSchema(): Promise<void> {
  if (!postgresSchemaReady) {
    postgresSchemaReady = runPostgresPatches().catch((err) => {
      postgresSchemaReady = null;
      throw err;
    });
  }
  return postgresSchemaReady;
}

async function runPostgresPatches(): Promise<void> {
  const connectionString = getPostgresConnectionString();
  if (!connectionString) return;

  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString });

  try {
    await pool.query(`
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

    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "cricket_snapshots_key_idx"
      ON "cricket_snapshots" USING btree ("key");
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS "payload_locked_documents_rels" (
        "id" serial PRIMARY KEY NOT NULL,
        "order" integer,
        "parent_id" integer NOT NULL,
        "path" varchar NOT NULL,
        "users_id" integer,
        "members_id" integer,
        "member_posts_id" integer,
        "member_follows_id" integer,
        "media_id" integer,
        "posts_id" integer,
        "hero_slides_id" integer,
        "cricket_snapshots_id" integer,
        "stand_discussions_id" integer,
        "chants_id" integer,
        "stand_reactions_id" integer,
        "stand_comments_id" integer,
        "match_chat_rooms_id" integer,
        "match_chat_messages_id" integer
      );
    `);

    await pool.query(`
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
        ADD COLUMN IF NOT EXISTS "match_chat_messages_id" integer,
        ADD COLUMN IF NOT EXISTS "countries_id" integer,
        ADD COLUMN IF NOT EXISTS "players_id" integer,
        ADD COLUMN IF NOT EXISTS "tracked_player_leagues_id" integer;
    `);

    await pool.query(`
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

    await pool.query(`
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
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "countries_slug_idx"
      ON "countries" USING btree ("slug");
    `);

    await pool.query(`
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
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "players_lookup_key_idx"
      ON "players" USING btree ("lookup_key");
    `);

    for (const table of ["privacy_policy", "terms_of_service"] as const) {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS "${table}" (
          "id" serial PRIMARY KEY NOT NULL,
          "subtitle" varchar NOT NULL,
          "last_updated" timestamp(3) with time zone NOT NULL,
          "content" jsonb NOT NULL,
          "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
          "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
        );
      `);
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS "tour_sync_state" (
        "id" serial PRIMARY KEY NOT NULL,
        "tour_id" varchar NOT NULL UNIQUE,
        "tour_slug" varchar NOT NULL,
        "current_status" varchar NOT NULL DEFAULT 'active' CHECK ("current_status" IN ('active', 'finished')),
        "test_series_status" varchar CHECK ("test_series_status" IN ('upcoming', 'active', 'finished')),
        "odi_series_status" varchar CHECK ("odi_series_status" IN ('upcoming', 'active', 'finished')),
        "t20_series_status" varchar CHECK ("t20_series_status" IN ('upcoming', 'active', 'finished')),
        "last_index_sync" timestamp(3) with time zone,
        "last_squad_sync_test" timestamp(3) with time zone,
        "last_squad_sync_odi" timestamp(3) with time zone,
        "last_squad_sync_t20" timestamp(3) with time zone,
        "squad_import_complete_test" boolean DEFAULT false,
        "squad_import_complete_odi" boolean DEFAULT false,
        "squad_import_complete_t20" boolean DEFAULT false,
        "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
        "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
      );
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS "idx_tour_sync_state_status"
      ON "tour_sync_state" USING btree ("current_status");
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS "idx_tour_sync_state_updated_at"
      ON "tour_sync_state" USING btree ("updated_at");
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS "idx_tour_sync_state_tour_id"
      ON "tour_sync_state" USING btree ("tour_id");
    `);
  } finally {
    await pool.end();
  }
}
