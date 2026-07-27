/**
 * Runs the REAL squad-refresh job against your LOCAL Postgres — the exact function the admin
 * panel's "squads" sync job triggers (refreshSquadsForActiveTours). No dev server needed; this
 * talks to Postgres + Payload's local API directly, same as scripts/rebuild-tour-details.ts.
 *
 * One manual prerequisite (do this once): local Postgres must be running.
 *   bash setup-local-dev.sh
 * (starts Postgres in Docker + the dev server + bootstraps the schema; Ctrl+C to stop, or just
 * leave it running in another terminal — this script only needs Postgres up, not the dev server).
 * Alternatively, if you already have Postgres running some other way, just make sure
 * POSTGRES_URL and PAYLOAD_SECRET are set in .env.local.
 *
 * Usage:
 *   npx tsx scripts/test-squad-sync-local.ts --seed
 *     Creates a throwaway test tour ("Australia tour of Bangladesh, 2026" under a fake
 *     tour_id so it can't collide with the real one), pastes a two-team manual squad exactly
 *     like the admin panel does, runs the real refreshSquadsForActiveTours() job, prints the
 *     resulting squads for both teams, then deletes the test tour. Fully self-contained —
 *     proves the fix end-to-end without touching production data.
 *
 *   npx tsx scripts/test-squad-sync-local.ts
 *     Runs the job against whatever real tours already exist in your local DB (e.g. if you've
 *     synced real data locally and pasted manual squad text via the local admin panel
 *     yourself). Prints the job result only.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

import type { Tour } from "../lib/cricket/types";

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

const TEST_TOUR_ID = "test-squad-sync-script";
const TEST_TOUR_SLUG = "test-squad-sync-script-bd-vs-aus";
const TEST_TOUR_NAME = "Australia tour of Bangladesh, 2026";

const SAMPLE_MANUAL_TEXT =
  "Australia Test squad: Pat Cummins (c), Scott Boland, Alex Carey (wk), Cameron Green\n\n" +
  "Bangladesh Test squad: Najmul Hossain Shanto (c), Mushfiqur Rahim (wk), Shadman Islam";

async function seedTestTour() {
  const { upsertTourSyncState, setTourManualSquadText } = await import(
    "../lib/cricket/services/tour-sync-state-db"
  );
  const { upsertCricketSnapshot } = await import("../lib/cricket/snapshot-db");
  const { CRICKET_SNAPSHOT_KEYS } = await import("../lib/cricket/snapshot-keys");
  const { tourToCard } = await import("../lib/cricket/services/tours-display");

  console.log("Seeding a throwaway test tour with a two-team manual squad paste...\n");

  const tour: Tour = { id: TEST_TOUR_ID, name: TEST_TOUR_NAME, test: 2 };

  await upsertCricketSnapshot(CRICKET_SNAPSHOT_KEYS.tourDetail(TEST_TOUR_SLUG), `Tour: ${tour.name}`, {
    tour,
    card: tourToCard(tour, 0),
    matches: [],
    squads: [],
    venues: [],
    warnings: [],
    fetchedAt: new Date().toISOString(),
    slug: TEST_TOUR_SLUG,
  });

  await upsertTourSyncState({
    tour_id: TEST_TOUR_ID,
    tour_slug: TEST_TOUR_SLUG,
    current_status: "active",
    test_series_status: "upcoming",
  });

  // This is the exact function behind the admin panel's manual-squad-text save button.
  await setTourManualSquadText(TEST_TOUR_ID, SAMPLE_MANUAL_TEXT);

  console.log("Seeded. This mirrors the bug scenario: nothing is 'stuck' yet since the test");
  console.log("tour starts fresh — run with a pre-existing tour to test the un-stick behavior.\n");
}

async function printResultingSquads() {
  const { readCricketSnapshot } = await import("../lib/cricket/snapshot-db");
  const { CRICKET_SNAPSHOT_KEYS } = await import("../lib/cricket/snapshot-keys");

  const detail = await readCricketSnapshot<{ squads: any[] }>(
    CRICKET_SNAPSHOT_KEYS.tourDetail(TEST_TOUR_SLUG),
  );

  console.log("\n--- Resulting squads for the test tour ---");
  if (!detail?.squads?.length) {
    console.log("(none — check the job result above for warnings)");
    return;
  }
  for (const squad of detail.squads) {
    console.log(`\n${squad.team} (${squad.players.length} players):`);
    for (const p of squad.players) {
      const tags = [p.isCaptain && "C", p.isWicketKeeper && "WK"].filter(Boolean).join("/");
      console.log(`  - ${p.name}${tags ? ` (${tags})` : ""}`);
    }
  }
}

async function cleanupTestTour() {
  console.log("\nCleaning up test tour...");
  const { deleteTourSyncState } = await import("../lib/cricket/services/tour-sync-state-db");
  const { CRICKET_SNAPSHOT_KEYS } = await import("../lib/cricket/snapshot-keys");
  const { getPayloadClient } = await import("../lib/payload");

  await deleteTourSyncState(TEST_TOUR_ID);

  const payload = await getPayloadClient();
  await payload.delete({
    collection: "cricket-snapshots",
    where: { key: { equals: CRICKET_SNAPSHOT_KEYS.tourDetail(TEST_TOUR_SLUG) } },
    overrideAccess: true,
  });
  console.log("Done.");
}

async function main() {
  loadEnvFiles();

  const { isPostgresDatabase } = await import("../lib/payload-postgres-url");
  const { isPayloadConfigured } = await import("../lib/payload-env");

  if (!isPostgresDatabase() || !isPayloadConfigured()) {
    console.error(
      "Postgres/Payload aren't configured for this process.\n" +
        "Start local Postgres first (one-time): bash setup-local-dev.sh\n" +
        "...or make sure POSTGRES_URL and PAYLOAD_SECRET are set in .env.local.",
    );
    process.exit(1);
  }

  const seed = process.argv.includes("--seed");
  if (seed) {
    await seedTestTour();
  }

  console.log("Running the real squad refresh job (refreshSquadsForActiveTours)...\n");
  const { refreshSquadsForActiveTours } = await import(
    "../lib/cricket/services/refresh-squads-for-active-tours"
  );
  const result = await refreshSquadsForActiveTours();
  console.log(JSON.stringify(result, null, 2));

  if (seed) {
    await printResultingSquads();
    await cleanupTestTour();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
