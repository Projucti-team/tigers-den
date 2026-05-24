import type { Payload } from "payload";

import { isProductionDatabase } from "@/lib/payload-db";

let schemaReady: Promise<void> | null = null;

/** Apply full Payload Drizzle schema to Postgres (no interactive prompts). */
export function ensurePayloadSchema(payload: Payload): Promise<void> {
  if (!isProductionDatabase()) return Promise.resolve();

  if (!schemaReady) {
    schemaReady = syncSchema(payload).catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  return schemaReady;
}

type DrizzleKitPush = {
  pushSchema: (
    schema: unknown,
    drizzle: unknown,
    schemaName?: string[],
    tablesFilter?: string[],
    extensionsFilter?: string[],
  ) => Promise<{ apply: () => Promise<void> }>;
};

type PostgresAdapterLike = {
  drizzle: unknown;
  extensions?: { postgis?: boolean };
  requireDrizzleKit: () => DrizzleKitPush;
  schema: unknown;
  schemaName?: string;
  tablesFilter?: string[];
};

async function syncSchema(payload: Payload): Promise<void> {
  const adapter = payload.db as PostgresAdapterLike;
  const { pushSchema } = adapter.requireDrizzleKit();
  const { apply } = await pushSchema(
    adapter.schema,
    adapter.drizzle,
    adapter.schemaName ? [adapter.schemaName] : undefined,
    adapter.tablesFilter,
    adapter.extensions?.postgis ? ["postgis"] : undefined,
  );

  await apply();
}
