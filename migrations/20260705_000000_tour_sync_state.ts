import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres";
import { sql } from "drizzle-orm";

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
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
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "idx_tour_sync_state_status" ON "tour_sync_state" ("current_status");
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "idx_tour_sync_state_updated_at" ON "tour_sync_state" ("updated_at");
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "idx_tour_sync_state_tour_id" ON "tour_sync_state" ("tour_id");
  `);

  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN IF NOT EXISTS "tour_sync_state_id" integer;
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels"
      DROP COLUMN IF EXISTS "tour_sync_state_id";
  `);
  await db.execute(sql`DROP TABLE IF EXISTS "tour_sync_state"`);
}
