import { getPostgresConnectionString, isPostgresDatabase } from "@/lib/payload-postgres-url";

/**
 * Standalone "feedback" table (see migrations/20260706_000000_feedback.ts) — deliberately NOT a
 * Payload collection, so it isn't touched by Payload's auto-migration. Access it via plain SQL,
 * the same pattern lib/cricket/services/tour-sync-state-db.ts uses for tour_sync_state.
 *
 * IMPORTANT: app/api/feedback/route.ts previously called payload.create({collection:"feedback"}),
 * which throws every time ("feedback" was never registered in payload.config.ts) — every
 * submission through that endpoint was failing. This module replaces that call.
 */

export type FeedbackCategory = "bug" | "feature" | "other";

export type FeedbackStatusEntry = {
  status: string;
  changedAt: string;
  note?: string;
};

export type CreateFeedbackInput = {
  title: string;
  description: string;
  category: FeedbackCategory;
  email?: string | null;
  name?: string | null;
  pageUrl: string;
  userId?: number | null;
  imageId?: number | null;
};

export type FeedbackRow = {
  id: number;
  title: string;
  description: string;
  category: FeedbackCategory;
  image_id: number | null;
  page_url: string;
  user_id: number | null;
  email: string | null;
  name: string | null;
  status: string;
  status_timeline: FeedbackStatusEntry[];
  created_at: string;
  updated_at: string;
};

type MinimalPool = {
  query: (text: string, params?: unknown[]) => Promise<{ rows: any[] }>;
  end: () => Promise<void>;
};

// Test-only seam, mirroring tour-sync-state-db.ts: lets integration tests point this module at
// an in-memory Postgres-compatible engine (pg-mem) instead of a real connection.
let poolFactoryOverride: (() => MinimalPool | Promise<MinimalPool>) | null = null;
export function __setPoolFactoryForTests(factory: typeof poolFactoryOverride): void {
  poolFactoryOverride = factory;
}

async function getDbPool(): Promise<MinimalPool> {
  if (poolFactoryOverride) return poolFactoryOverride();
  if (!isPostgresDatabase()) {
    throw new Error("feedback table requires Postgres database");
  }
  const connectionString = getPostgresConnectionString();
  if (!connectionString) {
    throw new Error("DATABASE_URL not configured");
  }
  const { Pool } = await import("pg");
  return new Pool({ connectionString });
}

export async function createFeedback(input: CreateFeedbackInput): Promise<FeedbackRow> {
  const pool = await getDbPool();
  try {
    const statusTimeline: FeedbackStatusEntry[] = [
      {
        status: "new",
        changedAt: new Date().toISOString(),
        note: "Feedback submitted",
      },
    ];

    const result = await pool.query(
      `INSERT INTO "feedback"
        ("title", "description", "category", "image_id", "page_url", "user_id", "email", "name", "status", "status_timeline")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'new', $9::jsonb)
       RETURNING *`,
      [
        input.title,
        input.description,
        input.category,
        input.imageId ?? null,
        input.pageUrl,
        input.userId ?? null,
        input.email ?? null,
        input.name ?? null,
        JSON.stringify(statusTimeline),
      ],
    );

    return result.rows[0] as FeedbackRow;
  } finally {
    await pool.end();
  }
}
