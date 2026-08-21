import { getPostgresConnectionString, isPostgresDatabase } from "@/lib/payload-postgres-url";

export type SyncJobRunRow = {
  job_id: string;
  last_run_at: string | null;
  last_success_at: string | null;
  last_ok: boolean | null;
  last_warnings: string[] | null;
  last_errors: string[] | null;
  updated_at: string;
};

type MinimalPool = {
  query: (text: string, params?: unknown[]) => Promise<{ rows: any[] }>;
  end: () => Promise<void>;
};

let poolFactoryOverride: (() => MinimalPool | Promise<MinimalPool>) | null = null;
export function __setPoolFactoryForTests(factory: typeof poolFactoryOverride): void {
  poolFactoryOverride = factory;
}

async function getDbPool(): Promise<MinimalPool> {
  if (poolFactoryOverride) return poolFactoryOverride();
  if (!isPostgresDatabase()) {
    throw new Error("cricket_sync_job_runs requires Postgres database");
  }
  const connectionString = getPostgresConnectionString();
  if (!connectionString) {
    throw new Error("DATABASE_URL not configured");
  }
  const { Pool } = await import("pg");
  return new Pool({ connectionString });
}

/**
 * Records one job's outcome so the admin panel can show "last ran successfully at ..." per
 * button — the existing sync-lock snapshot only remembers the single most-recent overall run, so
 * running one narrow job (e.g. WTC standings) would silently erase visibility into when a
 * different job (e.g. Bangladesh schedule) last succeeded.
 */
export async function recordSyncJobRun(
  jobId: string,
  outcome: { ok: boolean; warnings: string[]; errors: string[]; at?: string },
): Promise<void> {
  const pool = await getDbPool();
  const at = outcome.at ?? new Date().toISOString();
  try {
    await pool.query(
      `INSERT INTO "cricket_sync_job_runs" (
         "job_id", "last_run_at", "last_success_at", "last_ok", "last_warnings", "last_errors", "updated_at"
       ) VALUES ($1, $2, $3, $4, $5, $6, $2)
       ON CONFLICT ("job_id") DO UPDATE SET
         "last_run_at" = EXCLUDED."last_run_at",
         "last_success_at" = CASE WHEN $4 THEN EXCLUDED."last_run_at" ELSE "cricket_sync_job_runs"."last_success_at" END,
         "last_ok" = EXCLUDED."last_ok",
         "last_warnings" = EXCLUDED."last_warnings",
         "last_errors" = EXCLUDED."last_errors",
         "updated_at" = EXCLUDED."updated_at"`,
      [
        jobId,
        at,
        outcome.ok ? at : null,
        outcome.ok,
        JSON.stringify(outcome.warnings ?? []),
        JSON.stringify(outcome.errors ?? []),
      ],
    );
  } finally {
    await pool.end();
  }
}

export async function readAllSyncJobRuns(): Promise<Record<string, SyncJobRunRow>> {
  const pool = await getDbPool();
  try {
    const result = await pool.query(`SELECT * FROM "cricket_sync_job_runs"`);
    const byId: Record<string, SyncJobRunRow> = {};
    for (const row of (result.rows as SyncJobRunRow[]) ?? []) {
      byId[row.job_id] = row;
    }
    return byId;
  } finally {
    await pool.end();
  }
}
