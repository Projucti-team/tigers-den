import assert from "node:assert/strict";
import test from "node:test";

import { newDb } from "pg-mem";

import {
  __setPoolFactoryForTests,
  upsertBangladeshMatch,
  readLastCompletedBangladeshMatch,
  readLiveBangladeshMatches,
  readUpcomingBangladeshMatches,
} from "../../lib/cricket/services/bangladesh-matches-db.ts";

/**
 * Real integration test: runs the actual SQL from bangladesh-matches-db.ts against pg-mem, same
 * pattern as tests/unit/tour-sync-state-db.integration.test.ts. Locks in the contract the new
 * unified schedule table replaces data/bangladesh-last-match.json + data/bangladesh-upcoming-matches.json
 * with: one row per match, upserted by match_id, queryable by status instead of trusting a single
 * cached blob that could silently go stale.
 */
async function createTestPool() {
  const db = newDb({ autoCreateForeignKeyIndices: true });
  db.public.registerFunction({
    name: "now",
    returns: "timestamp" as any,
    implementation: () => new Date(),
  });

  db.public.none(`
    CREATE TABLE "bangladesh_matches" (
      "id" serial PRIMARY KEY NOT NULL,
      "match_id" varchar NOT NULL UNIQUE,
      "team_category" varchar NOT NULL,
      "match_type" varchar,
      "status" varchar NOT NULL,
      "status_text" varchar,
      "teams" jsonb,
      "opponent" varchar,
      "score_summary" varchar,
      "venue" varchar,
      "match_date" timestamp,
      "series_id" varchar,
      "series_name" varchar,
      "espn_league_id" integer,
      "espn_event_id" varchar,
      "source" varchar NOT NULL DEFAULT 'cricapi',
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL
    );
  `);

  const { Pool } = db.adapters.createPg();
  return new Pool();
}

test("integration: upsertBangladeshMatch inserts then updates the same match_id in place", async () => {
  const pool = await createTestPool();
  __setPoolFactoryForTests(async () => pool);

  try {
    await upsertBangladeshMatch({
      match_id: "cricapi-1",
      team_category: "men",
      status: "upcoming",
      status_text: "Match not started",
      teams: ["Bangladesh", "Australia"],
      opponent: "Australia",
      match_date: "2026-08-10T05:00:00.000Z",
      source: "cricapi",
    });

    // Same match_id, now completed with a result -- must overwrite, not duplicate.
    await upsertBangladeshMatch({
      match_id: "cricapi-1",
      team_category: "men",
      status: "completed",
      status_text: "Bangladesh won by 4 wickets",
      teams: ["Bangladesh", "Australia"],
      opponent: "Australia",
      match_date: "2026-08-10T05:00:00.000Z",
      source: "cricapi",
    });

    const last = await readLastCompletedBangladeshMatch();
    assert.equal(last?.match_id, "cricapi-1");
    assert.equal(last?.status, "completed");
    assert.match(last?.status_text ?? "", /won by 4 wickets/);
    assert.deepEqual(last?.teams, ["Bangladesh", "Australia"]);
  } finally {
    __setPoolFactoryForTests(null);
    await pool.end();
  }
});

test("integration: readLastCompletedBangladeshMatch picks the most recent across all team categories", async () => {
  const pool = await createTestPool();
  __setPoolFactoryForTests(async () => pool);

  try {
    await upsertBangladeshMatch({
      match_id: "women-1",
      team_category: "women",
      status: "completed",
      match_date: "2026-07-01T00:00:00.000Z",
      source: "cricapi",
    });
    await upsertBangladeshMatch({
      match_id: "men-1",
      team_category: "men",
      status: "completed",
      match_date: "2026-08-15T00:00:00.000Z",
      source: "cricapi",
    });
    await upsertBangladeshMatch({
      match_id: "u19-1",
      team_category: "u19",
      status: "completed",
      match_date: "2026-08-05T00:00:00.000Z",
      source: "cricapi",
    });

    const last = await readLastCompletedBangladeshMatch();
    // Men's Aug 15 result is the most recent by date, regardless of category.
    assert.equal(last?.match_id, "men-1");
  } finally {
    __setPoolFactoryForTests(null);
    await pool.end();
  }
});

test("integration: readLiveBangladeshMatches sorts men > women > u19 > emerging, never domestic", async () => {
  const pool = await createTestPool();
  __setPoolFactoryForTests(async () => pool);

  try {
    await upsertBangladeshMatch({
      match_id: "emerging-live",
      team_category: "emerging",
      status: "live",
      match_date: "2026-08-20T00:00:00.000Z",
      source: "cricapi",
    });
    await upsertBangladeshMatch({
      match_id: "u19-live",
      team_category: "u19",
      status: "live",
      match_date: "2026-08-20T00:00:00.000Z",
      source: "cricapi",
    });
    await upsertBangladeshMatch({
      match_id: "men-live",
      team_category: "men",
      status: "live",
      match_date: "2026-08-20T00:00:00.000Z",
      source: "cricapi",
    });

    const live = await readLiveBangladeshMatches();
    assert.deepEqual(
      live.map((m) => m.match_id),
      ["men-live", "u19-live", "emerging-live"],
    );
  } finally {
    __setPoolFactoryForTests(null);
    await pool.end();
  }
});

test("integration: readUpcomingBangladeshMatches returns only future matches, soonest first, respecting limit", async () => {
  const pool = await createTestPool();
  __setPoolFactoryForTests(async () => pool);

  try {
    const future = (daysFromNow: number) =>
      new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000).toISOString();

    await upsertBangladeshMatch({
      match_id: "past-1",
      team_category: "men",
      status: "upcoming",
      match_date: future(-2), // stale row a sync run failed to flip to completed -- must not leak in
      source: "cricapi",
    });
    await upsertBangladeshMatch({
      match_id: "soon-1",
      team_category: "men",
      status: "upcoming",
      match_date: future(3),
      source: "cricapi",
    });
    await upsertBangladeshMatch({
      match_id: "later-1",
      team_category: "women",
      status: "upcoming",
      match_date: future(10),
      source: "cricapi",
    });
    await upsertBangladeshMatch({
      match_id: "even-later-1",
      team_category: "u19",
      status: "upcoming",
      match_date: future(20),
      source: "cricapi",
    });

    const upcoming = await readUpcomingBangladeshMatches(2);
    assert.deepEqual(
      upcoming.map((m) => m.match_id),
      ["soon-1", "later-1"],
    );
  } finally {
    __setPoolFactoryForTests(null);
    await pool.end();
  }
});
