import { migrations } from "@/migrations";

import type { Payload } from "payload";

import { isProductionDatabase } from "@/lib/payload-db";

let schemaReady: Promise<void> | null = null;

/** Run committed SQL migrations (no drizzle-kit — safe on Vercel serverless). */
export function ensurePayloadSchema(payload: Payload): Promise<void> {
  if (!isProductionDatabase() || migrations.length === 0) return Promise.resolve();

  if (!schemaReady) {
    schemaReady = runMigrations(payload).catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  return schemaReady;
}

async function runMigrations(payload: Payload): Promise<void> {
  const db = payload.db as {
    migrate: (args: { migrations: typeof migrations }) => Promise<void>;
  };
  await db.migrate({ migrations });
}
