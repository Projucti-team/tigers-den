import assert from "node:assert/strict";
import test from "node:test";

import { newDb } from "pg-mem";

import {
  __setPoolFactoryForTests,
  countFeedbackByStatus,
  createFeedback,
  readAllFeedback,
  updateFeedbackStatus,
} from "../../lib/feedback-db.ts";

/**
 * Real integration test: runs the actual INSERT from lib/feedback-db.ts against pg-mem, an
 * in-memory Postgres-compatible engine. This exists because app/api/feedback/route.ts used to
 * call payload.create({collection:"feedback"}) -- but "feedback" was never registered in
 * payload.config.ts's collections array, so every submission threw
 * "The collection with slug feedback can't be found" and no feedback was ever actually saved.
 * feedback-db.ts replaces that call with plain SQL against the standalone table (see
 * migrations/20260706_000000_feedback.ts), matching the tour_sync_state precedent. This test
 * proves the INSERT actually works end-to-end, not just that it compiles.
 */
async function createTestPool() {
  const db = newDb({ autoCreateForeignKeyIndices: true });
  db.public.registerFunction({
    name: "now",
    returns: "timestamp" as any,
    implementation: () => new Date(),
  });

  // Same DDL as migrations/20260706_000000_feedback.ts.
  db.public.none(`
    CREATE TABLE "feedback" (
      "id" serial PRIMARY KEY NOT NULL,
      "title" varchar NOT NULL,
      "description" varchar NOT NULL,
      "category" varchar NOT NULL CHECK ("category" IN ('bug', 'feature', 'other')),
      "image_id" integer,
      "page_url" varchar NOT NULL,
      "user_id" integer,
      "email" varchar,
      "name" varchar,
      "status" varchar NOT NULL DEFAULT 'new' CHECK ("status" IN ('new', 'under_review', 'ticket_raised', 'in_progress', 'resolved', 'dismissed')),
      "status_timeline" jsonb,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
  `);

  const { Pool } = db.adapters.createPg();
  return new Pool();
}

test("integration: createFeedback inserts a real row and returns it (regression for the broken payload.create call)", async () => {
  const pool = await createTestPool();
  __setPoolFactoryForTests(async () => pool);

  try {
    const row = await createFeedback({
      title: "Type dropdown clips text",
      description: "After choosing a type, the select doesn't show the full label.",
      category: "bug",
      email: "fan@example.com",
      name: "Fan",
      pageUrl: "https://tigersden.example.com/match-centre",
      userId: null,
      imageId: null,
    });

    assert.equal(row.title, "Type dropdown clips text");
    assert.equal(row.category, "bug");
    assert.equal(row.status, "new");
    assert.ok(row.id > 0);

    const stored = await pool.query(`SELECT * FROM "feedback" WHERE "id" = $1`, [row.id]);
    assert.equal(stored.rows.length, 1);
    assert.equal(stored.rows[0].title, "Type dropdown clips text");
    assert.equal(stored.rows[0].image_id, null);

    const timeline = stored.rows[0].status_timeline;
    const parsedTimeline = typeof timeline === "string" ? JSON.parse(timeline) : timeline;
    assert.equal(parsedTimeline[0].status, "new");
    assert.equal(parsedTimeline[0].note, "Feedback submitted");
  } finally {
    __setPoolFactoryForTests(null);
    await pool.end();
  }
});

test("integration: createFeedback stores the attached image's media id", async () => {
  const pool = await createTestPool();
  __setPoolFactoryForTests(async () => pool);

  try {
    const row = await createFeedback({
      title: "Screenshot attached",
      description: "See the attached screenshot for the layout issue.",
      category: "bug",
      email: "fan@example.com",
      name: "Fan",
      pageUrl: "https://tigersden.example.com/tours",
      userId: 42,
      imageId: 7,
    });

    assert.equal(row.image_id, 7);
    assert.equal(row.user_id, 42);
  } finally {
    __setPoolFactoryForTests(null);
    await pool.end();
  }
});

test("integration: readAllFeedback filters by status and orders newest first", async () => {
  const pool = await createTestPool();
  __setPoolFactoryForTests(async () => pool);

  try {
    const first = await createFeedback({
      title: "First report",
      description: "d",
      category: "bug",
      pageUrl: "https://tigersden.example.com/a",
    });
    const second = await createFeedback({
      title: "Second report",
      description: "d",
      category: "feature",
      pageUrl: "https://tigersden.example.com/b",
    });
    await updateFeedbackStatus(first.id, "resolved", "Fixed it");

    const all = await readAllFeedback();
    assert.equal(all.length, 2);
    assert.equal(all[0].id, second.id, "newest first");

    const newOnly = await readAllFeedback("new");
    assert.equal(newOnly.length, 1);
    assert.equal(newOnly[0].id, second.id);

    const resolvedOnly = await readAllFeedback("resolved");
    assert.equal(resolvedOnly.length, 1);
    assert.equal(resolvedOnly[0].id, first.id);
  } finally {
    __setPoolFactoryForTests(null);
    await pool.end();
  }
});

test("integration: updateFeedbackStatus appends to the timeline instead of replacing it", async () => {
  const pool = await createTestPool();
  __setPoolFactoryForTests(async () => pool);

  try {
    const row = await createFeedback({
      title: "Needs triage",
      description: "d",
      category: "other",
      pageUrl: "https://tigersden.example.com/c",
    });
    assert.equal(row.status_timeline.length, 1);

    const afterFirst = await updateFeedbackStatus(row.id, "under_review", "Looking into it");
    assert.equal(afterFirst?.status, "under_review");
    assert.equal(afterFirst?.status_timeline.length, 2);
    assert.equal(afterFirst?.status_timeline[1].note, "Looking into it");

    const afterSecond = await updateFeedbackStatus(row.id, "resolved");
    assert.equal(afterSecond?.status, "resolved");
    assert.equal(afterSecond?.status_timeline.length, 3);
    // No note passed this time -- shouldn't crash, and shouldn't fabricate one.
    assert.equal(afterSecond?.status_timeline[2].note, undefined);

    assert.equal(await updateFeedbackStatus(999_999, "resolved"), null);
  } finally {
    __setPoolFactoryForTests(null);
    await pool.end();
  }
});

test("integration: countFeedbackByStatus counts only matching rows", async () => {
  const pool = await createTestPool();
  __setPoolFactoryForTests(async () => pool);

  try {
    const a = await createFeedback({
      title: "a",
      description: "d",
      category: "bug",
      pageUrl: "https://tigersden.example.com/a",
    });
    await createFeedback({
      title: "b",
      description: "d",
      category: "bug",
      pageUrl: "https://tigersden.example.com/b",
    });
    await updateFeedbackStatus(a.id, "resolved");

    assert.equal(await countFeedbackByStatus("new"), 1);
    assert.equal(await countFeedbackByStatus("resolved"), 1);
    assert.equal(await countFeedbackByStatus("dismissed"), 0);
  } finally {
    __setPoolFactoryForTests(null);
    await pool.end();
  }
});
