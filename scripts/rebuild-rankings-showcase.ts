/**
 * Rebuild ICC rankings showcase in Postgres (top 10 teams + Tigers in top 100).
 * Usage: npm run rebuild:rankings
 *
 * Requires DATABASE_URI + PAYLOAD_SECRET (loads .env.production when present).
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

import { logRankingsShowcaseStats } from "../lib/cricket/services/build-rankings-showcase";
import { refreshRankingsShowcase } from "../lib/cricket/services/rankings-display";

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

  console.log("Rebuilding ICC rankings showcase from live ICC feed…");
  const snapshot = await refreshRankingsShowcase();
  console.log(`Saved at ${snapshot.fetchedAt} (v${snapshot.version ?? 1})`);
  logRankingsShowcaseStats(snapshot);
  if (snapshot.warnings.length) {
    console.warn("Warnings:");
    for (const w of snapshot.warnings) console.warn(`  - ${w}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
