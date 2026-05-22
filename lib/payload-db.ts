import { sqliteAdapter } from "@payloadcms/db-sqlite";
import { vercelPostgresAdapter } from "@payloadcms/db-vercel-postgres";
import type { DatabaseAdapterObj } from "payload";

/** Neon / Vercel Postgres in production; SQLite file locally. */
export function getPayloadDatabase(): DatabaseAdapterObj {
  const postgresUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;

  if (postgresUrl) {
    return vercelPostgresAdapter({
      pool: {
        connectionString: postgresUrl,
      },
    });
  }

  return sqliteAdapter({
    client: {
      url: process.env.DATABASE_URI || "file:./tigersden.db",
    },
  });
}

export function isProductionDatabase(): boolean {
  return Boolean(process.env.POSTGRES_URL || process.env.DATABASE_URL);
}
