import { createClient, type Client } from "@libsql/client";

import { isProductionDatabase } from "@/lib/payload-db";

function sqliteClient(): Client | null {
  if (isProductionDatabase()) return null;

  const uri = process.env.DATABASE_URI?.trim();
  if (!uri?.startsWith("file:")) return null;

  const filePath = uri.replace(/^file:/, "");
  return createClient({ url: `file:${filePath}` });
}

/** Ensure cricket_snapshots exists on VPS SQLite DBs created before that collection was added. */
export async function ensureSqliteCricketSnapshotsTable(): Promise<void> {
  const client = sqliteClient();
  if (!client) return;

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

/** Match chat tables for Coolify/Docker SQLite (prodMigrations are Postgres-only). */
export async function ensureSqliteMatchChatTables(): Promise<void> {
  const client = sqliteClient();
  if (!client) return;

  await client.execute(`
    CREATE TABLE IF NOT EXISTS "match_chat_rooms" (
      "id" integer PRIMARY KEY NOT NULL,
      "match_id" text NOT NULL,
      "title" text NOT NULL,
      "ended_at" text,
      "updated_at" text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      "created_at" text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
    );
  `);

  await client.execute(`
    CREATE UNIQUE INDEX IF NOT EXISTS "match_chat_rooms_match_id_idx"
    ON "match_chat_rooms" ("match_id");
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS "match_chat_messages" (
      "id" integer PRIMARY KEY NOT NULL,
      "match_id" text NOT NULL,
      "author_id" integer NOT NULL,
      "body" text NOT NULL,
      "created_at" text NOT NULL,
      "updated_at" text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
    );
  `);

  await client.execute(`
    CREATE INDEX IF NOT EXISTS "match_chat_messages_match_id_idx"
    ON "match_chat_messages" ("match_id");
  `);

  await client.execute(`
    CREATE INDEX IF NOT EXISTS "match_chat_messages_match_created_idx"
    ON "match_chat_messages" ("match_id", "created_at");
  `);
}

/** Idempotent SQLite schema patches for VPS/Docker deploys. */
export async function ensureSqliteIncrementalSchema(): Promise<void> {
  await Promise.all([ensureSqliteCricketSnapshotsTable(), ensureSqliteMatchChatTables()]);
}
