import assert from "node:assert/strict";
import test from "node:test";

import { newDb } from "pg-mem";

import {
  __setPoolFactoryForTests,
  recordSyncJobRun,
  readAllSyncJobRuns,
} from "../../lib/cricket/services/sync-job-runs-db.ts";

/**
 * Real integration test against pg-mem (same pattern as tour-sync-state-db.integration.test.ts).
 * Locks in the behavior the admin panel depends on: last_success_at only advances on an ok=true
 * run, so a later failed run doesn't erase visibility into when a job last actually succeeded.
 */
async function createTestPool() {
  const db = newDb({ autoCreateForeignKeyIndices: true });
  db.public.registerFunction({
    name: "now",
    returns: "timestamp" as any,
    implementation: () => new Date(),
  });

  db.public.none(`
    CREATE TABLE "cricket_sync_job_runs" (
      "job_id" varchar PRIMARY KEY NOT NULL,
      "last_run_at" timestamp,
      "last_success_at" timestamp,
      "last_ok" boolean,
      "last_warnings" jsonb,
      "last_errors" jsonb,
      "updated_at" timestamp DEFAULT now() NOT NULL
    );
  `);

  const { Pool } = db.adapters.createPg();
  return new Pool();
}

test("integration: recordSyncJobRun inserts then updates the same job_id in place", async () => {
  const pool = await createTestPool();
  __setPoolFactoryForTests(async () => pool);

  try {
    await recordSyncJobRun("bangladesh-schedule", {
      ok: true,
      warnings: [],
      errors: [],
      at: "2026-08-20T03:45:00.000Z",
    });

    const runs = await readAllSyncJobRuns();
    assert.equal(runs["bangladesh-schedule"]?.last_ok, true);
    assert.equal(
      new Date(runs["bangladesh-schedule"]!.last_success_at!).toISOString(),
      "2026-08-20T03:45:00.000Z",
    );
  } finally {
    __setPoolFactoryForTests(null);
    await pool.end();
  }
});

test("integration: a later failed run updates last_run_at but keeps the previous last_success_at", async () => {
  const pool = await createTestPool();
  __setPoolFactoryForTests(async () => pool);

  try {
    await recordSyncJobRun("bangladesh-schedule", {
      ok: true,
      warnings: [],
      errors: [],
      at: "2026-08-20T03:45:00.000Z",
    });
    await recordSyncJobRun("bangladesh-schedule", {
      ok: false,
      warnings: [],
      errors: ["CricAPI request failed"],
      at: "2026-08-21T03:45:00.000Z",
    });

    const runs = await readAllSyncJobRuns();
    const row = runs["bangladesh-schedule"];
    assert.equal(row?.last_ok, false);
    assert.equal(new Date(row!.last_run_at!).toISOString(), "2026-08-21T03:45:00.000Z");
    // Still remembers the last time it actually succeeded, not overwritten by the failure.
    assert.equal(new Date(row!.last_success_at!).toISOString(), "2026-08-20T03:45:00.000Z");
    assert.deepEqual(row?.last_errors, ["CricAPI request failed"]);
  } finally {
    __setPoolFactoryForTests(null);
    await pool.end();
  }
});

test("integration: readAllSyncJobRuns tracks multiple jobs independently", async () => {
  const pool = await createTestPool();
  __setPoolFactoryForTests(async () => pool);

  try {
    await recordSyncJobRun("tours", { ok: true, warnings: [], errors: [] });
    await recordSyncJobRun("wtc", { ok: true, warnings: [], errors: [] });

    const runs = await readAllSyncJobRuns();
    assert.ok(runs.tours);
    assert.ok(runs.wtc);
    assert.equal(runs["bangladesh-schedule"], undefined);
  } finally {
    __setPoolFactoryForTests(null);
    await pool.end();
  }
});
