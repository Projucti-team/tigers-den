/**
 * Run cricket snapshots (including tours) directly during Vercel builds.
 * Uses POSTGRES_URL + CRICKET_DATA_API_KEY from the build environment — no HTTP round-trip.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

import { runDeployBootstrap } from "../lib/deploy/bootstrap";

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

async function main() {
  loadEnvFiles();

  if (!process.env.POSTGRES_URL?.trim() && !process.env.DATABASE_URL?.trim()) {
    console.log("[deploy:cricket-sync] No POSTGRES_URL — skipping (local SQLite build).");
    return;
  }

  if (!process.env.PAYLOAD_SECRET?.trim()) {
    console.warn("[deploy:cricket-sync] PAYLOAD_SECRET not set — skipping.");
    return;
  }

  if (!process.env.CRICKET_DATA_API_KEY?.trim()) {
    console.warn(
      "[deploy:cricket-sync] CRICKET_DATA_API_KEY not set — tours will not sync. Add it in Vercel env vars.",
    );
    return;
  }

  console.log("[deploy:cricket-sync] Starting cricket snapshot sync (tours + rankings)…");

  const result = await runDeployBootstrap({ forceCricketSync: true });

  if (result.errors.length) {
    for (const err of result.errors) console.warn(`[deploy:cricket-sync] ${err}`);
  }

  const sync = result.cricketSyncResult;
  if (sync) {
    console.log(
      `[deploy:cricket-sync] Tours: ${sync.toursCount}, tour details: ${sync.tourDetailsCount}`,
    );
    if (sync.warnings.length) {
      for (const w of sync.warnings) console.warn(`[deploy:cricket-sync] warning: ${w}`);
    }
    if (sync.errors.length) {
      for (const e of sync.errors) console.error(`[deploy:cricket-sync] error: ${e}`);
    }
  }

  if (result.cricketSync === "failed") {
    console.error("[deploy:cricket-sync] Sync failed — check logs above.");
    process.exit(1);
  }

  if (result.cricketSync === "skipped") {
    console.warn(`[deploy:cricket-sync] Sync skipped (${result.errors.join("; ") || "unknown"}).`);
    return;
  }

  if (sync && sync.toursCount === 0 && process.env.CRICKET_DATA_API_KEY?.trim()) {
    console.warn(
      "[deploy:cricket-sync] No tours were saved — CricAPI may be down or quota exhausted.",
    );
  }

  console.log("[deploy:cricket-sync] Done.");
}

main().catch((err) => {
  console.error("[deploy:cricket-sync] fatal:", err);
  process.exit(1);
});
