/**
 * Rebuild tour detail pages (fixtures, results, venues) into data/tour-details.json
 * and cricket-snapshots DB.
 *
 * Prefer `npm run sync:cricket` on the deployed app — that runs the full nightly job.
 * This script is for manual rebuilds when Payload DB is configured locally.
 *
 * Usage: npm run rebuild:tour-details
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

import { fetchCuratedEspnTours } from "../lib/cricket/providers/espn-fixtures";
import { buildTourDetailLive, toTourDetailSnapshot } from "../lib/cricket/services/build-tour-detail";
import { writeTourDetailSnapshot } from "../lib/cricket/tour-detail-store";
import { tourSlug } from "../lib/cricket/tour-slug";
import { isPayloadConfigured } from "../lib/payload-env";

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

  const tours = await fetchCuratedEspnTours();
  if (!tours.length) {
    console.warn("No curated future tours found in data/espn-fixture-times.json");
    return;
  }

  console.log(`Rebuilding ${tours.length} tour detail page(s) from ESPNcricinfo…`);

  for (const tour of tours) {
    const slug = tourSlug(tour);
    console.log(`  ${slug} — ${tour.name}`);

    const detail = toTourDetailSnapshot(await buildTourDetailLive(tour), slug);
    await writeTourDetailSnapshot(slug, detail);

    if (isPayloadConfigured()) {
      const { upsertCricketSnapshot } = await import("../lib/cricket/snapshot-db");
      const { CRICKET_SNAPSHOT_KEYS } = await import("../lib/cricket/snapshot-keys");
      await upsertCricketSnapshot(
        CRICKET_SNAPSHOT_KEYS.tourDetail(slug),
        `Tour: ${tour.name}`,
        detail,
      );
    }

    console.log(
      `    ${detail.matches.length} fixtures, ${detail.venues.length} venues, saved ${detail.fetchedAt}`,
    );
    for (const warning of detail.warnings) {
      console.warn(`    warning: ${warning}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
