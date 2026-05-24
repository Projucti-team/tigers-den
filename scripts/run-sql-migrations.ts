/**
 * Apply Payload SQL migrations without loading Payload CLI (avoids @next/env / undici issues).
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { up } from "../migrations/20260524_000000_initial_schema";

function loadEnvFiles() {
  for (const name of [".env", ".env.local"]) {
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

async function main() {
  loadEnvFiles();

  const connectionString =
    process.env.POSTGRES_URL?.trim() || process.env.DATABASE_URL?.trim();

  if (!connectionString) {
    console.log("[deploy:migrate] No POSTGRES_URL — skipping (local SQLite build).");
    return;
  }

  const pool = new Pool({ connectionString });
  const db = drizzle(pool);

  try {
    const exists = await pool.query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'cricket_snapshots'`,
    );

    if ((exists.rowCount ?? 0) > 0) {
      console.log("[deploy:migrate] Schema already present — skipping.");
      return;
    }

    console.log("[deploy:migrate] Applying initial schema…");
    await up({ db } as unknown as Parameters<typeof up>[0]);
    console.log("[deploy:migrate] Done.");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("[deploy:migrate] fatal:", err);
  process.exit(1);
});
