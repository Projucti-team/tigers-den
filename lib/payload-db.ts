import { sqliteAdapter } from "@payloadcms/db-sqlite";
import { vercelPostgresAdapter } from "@payloadcms/db-vercel-postgres";
import type { DatabaseAdapterObj } from "payload";

import { migrations } from "../migrations";

/** Neon / Vercel Postgres in production; SQLite file locally. */
export function getPayloadDatabase(): DatabaseAdapterObj {
  const postgresUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;

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
  });
}

/** Postgres (Vercel/Neon) — uses committed SQL migrations. */
export function isProductionDatabase(): boolean {
  return Boolean(process.env.POSTGRES_URL || process.env.DATABASE_URL);
}

/** Any persisted Payload DB (Postgres or SQLite file on VPS/Docker). */
export function hasPersistedDatabase(): boolean {
  return Boolean(
    process.env.POSTGRES_URL?.trim() ||
      process.env.DATABASE_URL?.trim() ||
      process.env.DATABASE_URI?.trim(),
  );
}
