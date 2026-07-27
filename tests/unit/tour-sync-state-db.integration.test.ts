import assert from "node:assert/strict";
import test from "node:test";

import { newDb } from "pg-mem";

import {
  __setPoolFactoryForTests,
  getSquadRefreshTargets,
  setTourManualSquadText,
  readTourSyncState,
} from "../../lib/cricket/services/tour-sync-state-db.ts";

/**
 * Real integration test: runs the actual SQL from tour-sync-state-db.ts (the same UPDATE/SELECT
 * statements that hit production Postgres) against pg-mem, an in-memory Postgres-compatible
 * engine. No live database needed, but the SQL itself is genuinely executed -- this is not a
 * reimplementation of the logic in test code, unlike tests/unit/squad-refresh.test.ts and
 * friends (which redefine functions inline and, worse, aren't even wired into `npm test` --
 * see CLAUDE.md discussion). Proves end-to-end that saving new manual squad text actually
 * un-sticks a tour that getSquadRefreshTargets() had previously stopped checking.
 */
async function createTestPool() {
  const db = newDb({ autoCreateForeignKeyIndices: true });
  db.public.registerFunction({
    name: "now",
    returns: "timestamp" as any,
    implementation: () => new Date(),
  });

  // Same DDL as migrations/20260705_000000_tour_sync_state.ts +
  // migrations/20260723_000000_tour_series_override.ts + .../20260723_000001_tour_squad_story_url.ts
  // + .../20260724_000001_tour_manual_squad_text.ts, trimmed to what this module touches.
  db.public.none(`
    CREATE TABLE "tour_sync_state" (
      "id" serial PRIMARY KEY NOT NULL,
      "tour_id" varchar NOT NULL UNIQUE,
      "tour_slug" varchar NOT NULL,
      "current_status" varchar NOT NULL DEFAULT 'active',
      "test_series_status" varchar,
      "odi_series_status" varchar,
      "t20_series_status" varchar,
      "last_index_sync" timestamp,
      "last_squad_sync_test" timestamp,
      "last_squad_sync_odi" timestamp,
      "last_squad_sync_t20" timestamp,
      "squad_import_complete_test" boolean DEFAULT false,
      "squad_import_complete_odi" boolean DEFAULT false,
      "squad_import_complete_t20" boolean DEFAULT false,
      "espn_cricinfo_series_id" integer,
      "espn_league_id" integer,
      "espn_series_override" integer,
      "squad_story_url" text,
      "manual_squad_text" text,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL
    );
  `);

  const { Pool } = db.adapters.createPg();
  return new Pool();
}

test("integration: saving manual squad text un-sticks a tour getSquadRefreshTargets had stopped checking", async () => {
  const pool = await createTestPool();
  __setPoolFactoryForTests(async () => pool);

  try {
    // Seed the exact scenario reported: Australia's Test squad already synced successfully
    // (squad_import_complete_test = true), tour still active/upcoming for Test cricket.
    await pool.query(
      `INSERT INTO "tour_sync_state"
         ("tour_id", "tour_slug", "current_status", "test_series_status", "squad_import_complete_test")
       VALUES ($1, $2, 'active', 'upcoming', true)`,
      ["1532475", "australia-tour-of-bangladesh-2026"],
    );

    // Confirms the reported bug: the tour is stuck, invisible to the refresh job.
    const before = await getSquadRefreshTargets();
    assert.deepEqual(
      before.find((t) => t.tour_id === "1532475"),
      undefined,
    );

    // Admin pastes Bangladesh's squad and saves -- this is the real function wired to the
    // admin API route (app/api/admin/tour-series/route.ts).
    await setTourManualSquadText(
      "1532475",
      "Bangladesh Test squad: Najmul Hossain Shanto (c), Mushfiqur Rahim (wk), Shadman Islam",
    );

    // The flag must actually be false in the database now, not just in application memory.
    const state = await readTourSyncState("1532475");
    assert.equal(state?.squad_import_complete_test, false);
    assert.match(state?.manual_squad_text ?? "", /Najmul Hossain Shanto/);

    // And the tour must reappear as a real refresh target.
    const after = await getSquadRefreshTargets();
    const target = after.find((t) => t.tour_id === "1532475");
    assert.ok(target, "tour should be a refresh target again after manual squad text is saved");
    assert.deepEqual(target!.matchTypes, ["test"]);
  } finally {
    __setPoolFactoryForTests(null);
    await pool.end();
  }
});

test("integration: clearing manual squad text (set to null) does not touch the completion flags", async () => {
  const pool = await createTestPool();
  __setPoolFactoryForTests(async () => pool);

  try {
    await pool.query(
      `INSERT INTO "tour_sync_state"
         ("tour_id", "tour_slug", "current_status", "test_series_status", "squad_import_complete_test")
       VALUES ($1, $2, 'active', 'upcoming', true)`,
      ["1538288", "bangladesh-tour-of-zimbabwe-2026"],
    );

    await setTourManualSquadText("1538288", null);

    const state = await readTourSyncState("1538288");
    assert.equal(state?.manual_squad_text, null);
    // Clearing text isn't "new information to re-check" -- leave the flag alone.
    assert.equal(state?.squad_import_complete_test, true);
  } finally {
    __setPoolFactoryForTests(null);
    await pool.end();
  }
});
