import { sql } from "drizzle-orm";
import type { Payload } from "payload";

/** Push Payload Drizzle schema to Postgres. Must run outside the Next.js bundle (e.g. Vercel build). */
export async function syncPayloadSchema(payload: Payload): Promise<void> {
  const adapter = payload.db as {
    drizzle: unknown;
    extensions?: { postgis?: boolean };
    requireDrizzleKit: () => {
      pushSchema: (
        schema: unknown,
        drizzle: unknown,
        schemaName?: string[],
        tablesFilter?: string[],
        extensionsFilter?: string[],
      ) => Promise<{ apply: () => Promise<void> }>;
    };
    schema: unknown;
    schemaName?: string;
    tablesFilter?: string[];
  };

  const db = adapter.drizzle as { execute: (query: ReturnType<typeof sql>) => Promise<unknown> };

  try {
    await db.execute(sql`DELETE FROM "payload_migrations" WHERE batch = -1`);
  } catch {
    // Table may not exist yet on first deploy.
  }

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
