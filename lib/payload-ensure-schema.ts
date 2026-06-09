import { migrations } from "@/migrations";

import type { Payload } from "payload";

import { ensurePostgresPayloadSchema } from "@/lib/payload-ensure-postgres-schema";
import { ensureSqliteIncrementalSchema } from "@/lib/payload-ensure-sqlite-schema";
import { isProductionDatabase } from "@/lib/payload-db";

let schemaReady: Promise<void> | null = null;

/** Run committed SQL migrations (Postgres) or incremental SQLite DDL (VPS/Docker). */
export function ensurePayloadSchema(payload: Payload): Promise<void> {
  if (!schemaReady) {
    schemaReady = runSchemaEnsure(payload).catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  return schemaReady;
}

async function runSchemaEnsure(payload: Payload): Promise<void> {
  if (isProductionDatabase()) {
    await ensurePostgresPayloadSchema();
    if (migrations.length === 0) return;
    const adapter = payload.db as {
      migrate: (args: { migrations: typeof migrations }) => Promise<void>;
    };
    await adapter.migrate({ migrations });
    return;
  }

  const uri = process.env.DATABASE_URI?.trim();
  if (uri?.startsWith("file:")) {
    await ensureSqliteIncrementalSchema();
  }
}
