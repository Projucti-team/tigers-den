import { sqliteAdapter } from "@payloadcms/db-sqlite";
import type { DatabaseAdapterObj } from "payload";

/** SQLite database for Coolify/VPS deployments. */
export function getPayloadDatabase(): DatabaseAdapterObj {
  return sqliteAdapter({
    client: {
      url: process.env.DATABASE_URI || "file:./tigersden.db",
    },
    // One-time on Hetzner if cricket_snapshots table is missing: PAYLOAD_SQLITE_PUSH_SCHEMA=1 then redeploy
    push: process.env.PAYLOAD_SQLITE_PUSH_SCHEMA === "1",
  });
}

/** SQLite is the production database in this deployment model. */
export function isProductionDatabase(): boolean {
  return true;
}

/** Any persisted Payload DB (Postgres or SQLite file on VPS/Docker). */
export function hasPersistedDatabase(): boolean {
  return Boolean(
    process.env.POSTGRES_URL?.trim() ||
      process.env.DATABASE_URL?.trim() ||
      process.env.DATABASE_URI?.trim(),
  );
}
