import { postgresAdapter } from "@payloadcms/db-postgres";
import { sqliteAdapter } from "@payloadcms/db-sqlite";
import type { DatabaseAdapterObj } from "payload";

import { getPostgresConnectionString, isPostgresDatabase } from "@/lib/payload-postgres-url";

import { migrations } from "../migrations";

/** Postgres on-server (Coolify) when POSTGRES_URL is set; otherwise SQLite for local dev. */
export function getPayloadDatabase(): DatabaseAdapterObj {
  const postgresUrl = getPostgresConnectionString();

  if (postgresUrl) {
    return postgresAdapter({
      pool: {
        connectionString: postgresUrl,
      },
      prodMigrations: migrations,
      // Schema is managed entirely by hand-written migrations (see migrations/index.ts), same
      // in dev as in production -- without this, Payload's Postgres adapter defaults to an
      // interactive drizzle-kit "push schema" prompt in dev mode, which needs a real attached
      // terminal to answer and hangs indefinitely when the dev server runs in the background
      // (e.g. via setup-local-dev.sh).
      push: false,
    });
  }

  return sqliteAdapter({
    client: {
      url: process.env.DATABASE_URI || "file:./tigersden.db",
    },
    // One-time on Hetzner if cricket_snapshots table is missing: PAYLOAD_SQLITE_PUSH_SCHEMA=1 then redeploy
    push: process.env.PAYLOAD_SQLITE_PUSH_SCHEMA === "1",
  });
}

/** True when running against Postgres (server or hosted). */
export function isProductionDatabase(): boolean {
  return isPostgresDatabase();
}

/** Any persisted Payload DB (Postgres or SQLite file on VPS/Docker). */
export function hasPersistedDatabase(): boolean {
  return Boolean(
    process.env.POSTGRES_URL?.trim() ||
      process.env.DATABASE_URL?.trim() ||
      process.env.DATABASE_URI?.trim(),
  );
}
