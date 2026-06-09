import { sqliteAdapter } from "@payloadcms/db-sqlite";
import { vercelPostgresAdapter } from "@payloadcms/db-vercel-postgres";
import type { DatabaseAdapterObj } from "payload";

import { getPostgresConnectionString, isPostgresDatabase } from "@/lib/payload-postgres-url";

import { migrations } from "../migrations";

/** Neon / Vercel Postgres in production; SQLite file locally. */
export function getPayloadDatabase(): DatabaseAdapterObj {
  const postgresUrl = getPostgresConnectionString();

  if (postgresUrl) {
    return vercelPostgresAdapter({
      pool: {
        connectionString: postgresUrl,
      },
      prodMigrations: migrations,
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

/** Postgres (Vercel/Neon/Coolify) — uses committed SQL migrations. */
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
