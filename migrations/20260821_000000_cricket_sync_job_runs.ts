import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres";
import { sql } from "drizzle-orm";

/**
 * Tracks per-job sync history so the admin panel can show "last ran successfully at ..." next to
 * each button, instead of only the single most-recent overall run (sync-lock's lastResult gets
 * overwritten by whichever job ran last, even a single narrow one like "WTC standings", so it
 * can't answer "when did Bangladesh schedule last succeed?" once something else has run since).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "cricket_sync_job_runs" (
      "job_id" varchar PRIMARY KEY NOT NULL,
      "last_run_at" timestamp(3) with time zone,
      "last_success_at" timestamp(3) with time zone,
      "last_ok" boolean,
      "last_warnings" jsonb,
      "last_errors" jsonb,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP TABLE IF EXISTS "cricket_sync_job_runs"`);
}
