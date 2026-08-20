import { getPostgresConnectionString } from "@/lib/payload-postgres-url";
import { isPostgresDatabase } from "@/lib/payload-postgres-url";
import { matchCategoryPriority, type MatchCategory } from "@/lib/cricket/match-category";

export type BangladeshMatchStatus = "live" | "completed" | "upcoming";

export type BangladeshMatchRow = {
  id: number;
  match_id: string;
  team_category: MatchCategory;
  match_type: string | null;
  status: BangladeshMatchStatus;
  status_text: string | null;
  teams: string[] | null;
  opponent: string | null;
  score_summary: string | null;
  venue: string | null;
  match_date: string | null;
  series_id: string | null;
  series_name: string | null;
  espn_league_id: number | null;
  espn_event_id: string | null;
  source: string;
  created_at: string;
  updated_at: string;
};

export type BangladeshMatchUpsert = {
  match_id: string;
  team_category: MatchCategory;
  match_type?: string | null;
  status: BangladeshMatchStatus;
  status_text?: string | null;
  teams?: string[] | null;
  opponent?: string | null;
  score_summary?: string | null;
  venue?: string | null;
  match_date?: string | null;
  series_id?: string | null;
  series_name?: string | null;
  espn_league_id?: number | null;
  espn_event_id?: string | null;
  source?: string;
};

type MinimalPool = {
  query: (text: string, params?: unknown[]) => Promise<{ rows: any[] }>;
  end: () => Promise<void>;
};

// Test-only seam, same pattern as tour-sync-state-db.ts: lets integration tests point every
// function here at pg-mem instead of a real connection.
let poolFactoryOverride: (() => MinimalPool | Promise<MinimalPool>) | null = null;
export function __setPoolFactoryForTests(factory: typeof poolFactoryOverride): void {
  poolFactoryOverride = factory;
}

async function getDbPool(): Promise<MinimalPool> {
  if (poolFactoryOverride) return poolFactoryOverride();
  if (!isPostgresDatabase()) {
    throw new Error("bangladesh_matches requires Postgres database");
  }
  const connectionString = getPostgresConnectionString();
  if (!connectionString) {
    throw new Error("DATABASE_URL not configured");
  }
  const { Pool } = await import("pg");
  return new Pool({ connectionString });
}

/**
 * One row per match, upserted by match_id on every sync run. Replaces the old single-blob
 * snapshot files (data/bangladesh-last-match.json, data/bangladesh-upcoming-matches.json) that
 * silently stopped updating whenever the discovery scan behind them found nothing new -- a plain
 * table means "what's the latest result / what's live / what's next" is always a fresh query,
 * never a cache that can go stale without anyone noticing.
 */
export async function upsertBangladeshMatch(row: BangladeshMatchUpsert): Promise<void> {
  const pool = await getDbPool();
  try {
    await pool.query(
      `INSERT INTO "bangladesh_matches" (
         "match_id", "team_category", "match_type", "status", "status_text",
         "teams", "opponent", "score_summary", "venue", "match_date",
         "series_id", "series_name", "espn_league_id", "espn_event_id", "source", "updated_at"
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())
       ON CONFLICT ("match_id") DO UPDATE SET
         "team_category" = EXCLUDED."team_category",
         "match_type" = EXCLUDED."match_type",
         "status" = EXCLUDED."status",
         "status_text" = EXCLUDED."status_text",
         "teams" = EXCLUDED."teams",
         "opponent" = EXCLUDED."opponent",
         "score_summary" = EXCLUDED."score_summary",
         "venue" = EXCLUDED."venue",
         "match_date" = EXCLUDED."match_date",
         "series_id" = EXCLUDED."series_id",
         "series_name" = EXCLUDED."series_name",
         "espn_league_id" = EXCLUDED."espn_league_id",
         "espn_event_id" = EXCLUDED."espn_event_id",
         "source" = EXCLUDED."source",
         "updated_at" = NOW()`,
      [
        row.match_id,
        row.team_category,
        row.match_type ?? null,
        row.status,
        row.status_text ?? null,
        row.teams ? JSON.stringify(row.teams) : null,
        row.opponent ?? null,
        row.score_summary ?? null,
        row.venue ?? null,
        row.match_date ?? null,
        row.series_id ?? null,
        row.series_name ?? null,
        row.espn_league_id ?? null,
        row.espn_event_id ?? null,
        row.source ?? "cricapi",
      ],
    );
  } finally {
    await pool.end();
  }
}

export async function upsertBangladeshMatches(rows: BangladeshMatchUpsert[]): Promise<void> {
  for (const row of rows) {
    await upsertBangladeshMatch(row);
  }
}

/** Most recent completed match across every team category. */
export async function readLastCompletedBangladeshMatch(): Promise<BangladeshMatchRow | null> {
  const pool = await getDbPool();
  try {
    const result = await pool.query(
      `SELECT * FROM "bangladesh_matches" WHERE "status" = 'completed' ORDER BY "match_date" DESC LIMIT 1`,
    );
    return (result.rows[0] as BangladeshMatchRow) ?? null;
  } finally {
    await pool.end();
  }
}

/** Every match currently flagged live, highest-priority team first (men > women > u19 > emerging). */
export async function readLiveBangladeshMatches(): Promise<BangladeshMatchRow[]> {
  const pool = await getDbPool();
  try {
    const result = await pool.query(`SELECT * FROM "bangladesh_matches" WHERE "status" = 'live'`);
    const rows = (result.rows as BangladeshMatchRow[]) ?? [];
    return rows.sort(
      (a, b) => matchCategoryPriority(a.team_category) - matchCategoryPriority(b.team_category),
    );
  } finally {
    await pool.end();
  }
}

/** Next N upcoming matches across every team category, soonest first. */
export async function readUpcomingBangladeshMatches(
  limit = 5,
): Promise<BangladeshMatchRow[]> {
  const pool = await getDbPool();
  try {
    const result = await pool.query(
      `SELECT * FROM "bangladesh_matches"
       WHERE "status" = 'upcoming' AND "match_date" > $2
       ORDER BY "match_date" ASC
       LIMIT $1`,
      [limit, new Date().toISOString()],
    );
    return (result.rows as BangladeshMatchRow[]) ?? [];
  } finally {
    await pool.end();
  }
}
