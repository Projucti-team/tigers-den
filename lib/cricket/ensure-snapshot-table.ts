import type { MigrateUpArgs } from "@payloadcms/db-vercel-postgres";
import { sql } from "drizzle-orm";
import type { Payload } from "payload";

import { isProductionDatabase } from "@/lib/payload-db";

let tableReady: Promise<void> | null = null;

/** Create cricket_snapshots in Postgres when missing (no interactive migrate). */
export function ensureCricketSnapshotsTable(payload: Payload): Promise<void> {
  if (!isProductionDatabase()) return Promise.resolve();

  if (!tableReady) {
    tableReady = createTable(payload).catch((err) => {
      tableReady = null;
      throw err;
    });
  }
  return tableReady;
}

async function createTable(payload: Payload): Promise<void> {
  const db = payload.db.drizzle as unknown as MigrateUpArgs["db"];
  await db.execute(sql`
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
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "cricket_snapshots_key_idx"
    ON "cricket_snapshots" USING btree ("key");
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "cricket_snapshots_updated_at_idx"
    ON "cricket_snapshots" USING btree ("updated_at");
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "cricket_snapshots_created_at_idx"
    ON "cricket_snapshots" USING btree ("created_at");
  `);
}
