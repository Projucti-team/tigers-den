import { createClient } from "@libsql/client";

import { isProductionDatabase } from "@/lib/payload-db";

/** Ensure cricket_snapshots exists on VPS SQLite DBs created before that collection was added. */
export async function ensureSqliteCricketSnapshotsTable(): Promise<void> {
  if (isProductionDatabase()) return;

  const uri = process.env.DATABASE_URI?.trim();
  if (!uri?.startsWith("file:")) return;

  const filePath = uri.replace(/^file:/, "");
  const client = createClient({ url: `file:${filePath}` });

  await client.execute(`
    CREATE TABLE IF NOT EXISTS "cricket_snapshots" (
      "id" integer PRIMARY KEY NOT NULL,
      "key" text NOT NULL,
      "label" text NOT NULL,
      "fetched_at" text NOT NULL,
      "data" text NOT NULL,
      "updated_at" text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      "created_at" text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
    );
  `);

  await client.execute(`
    CREATE UNIQUE INDEX IF NOT EXISTS "cricket_snapshots_key_idx"
    ON "cricket_snapshots" ("key");
  `);
}
