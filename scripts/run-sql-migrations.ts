/**
 * Apply pending Payload SQL migrations without loading Payload CLI (Vercel builds).
 * Coolify/Docker SQLite uses ensureSqliteIncrementalSchema at runtime instead.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { migrations } from "../migrations";

function loadEnvFiles() {
  for (const name of [".env", ".env.local", ".env.production"]) {
    const path = resolve(process.cwd(), name);
    if (!existsSync(path)) continue;
    const content = readFileSync(path, "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }
}

async function latestBatch(pool: Pool): Promise<number> {
  const exists = await pool.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payload_migrations'`,
  );
  if ((exists.rowCount ?? 0) === 0) return 0;

  const result = await pool.query<{ batch: string | number | null }>(
    `SELECT batch FROM payload_migrations ORDER BY batch DESC NULLS LAST LIMIT 1`,
  );
  const batch = Number(result.rows[0]?.batch ?? 0);
  return Number.isFinite(batch) ? batch : 0;
}

async function appliedNames(pool: Pool): Promise<Set<string>> {
  const exists = await pool.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payload_migrations'`,
  );
  if ((exists.rowCount ?? 0) === 0) return new Set();

  const result = await pool.query<{ name: string | null }>(
    `SELECT name FROM payload_migrations WHERE name IS NOT NULL`,
  );
  return new Set(result.rows.map((row) => String(row.name)));
}

async function main() {
  loadEnvFiles();

  const { getPostgresConnectionString } = await import("../lib/payload-postgres-url");
  const connectionString = getPostgresConnectionString();

  if (!connectionString) {
    console.log("[deploy:migrate] No POSTGRES_URL — skipping (SQLite uses runtime schema ensure).");
    return;
  }

  const pool = new Pool({ connectionString });
  const db = drizzle(pool);

  try {
    const done = await appliedNames(pool);
    const pending = migrations.filter((m) => !done.has(m.name));

    if (pending.length === 0) {
      console.log("[deploy:migrate] All migrations already applied.");
      return;
    }

    const batch = (await latestBatch(pool)) + 1;

    for (const migration of pending) {
      console.log(`[deploy:migrate] Applying ${migration.name}…`);
      await migration.up({ db } as unknown as Parameters<typeof migration.up>[0]);
      await pool.query(`INSERT INTO payload_migrations (name, batch) VALUES ($1, $2)`, [
        migration.name,
        batch,
      ]);
      console.log(`[deploy:migrate] Applied ${migration.name}.`);
    }

    console.log("[deploy:migrate] Done.");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("[deploy:migrate] fatal:", err);
  process.exit(1);
});
