import { getPostgresConnectionString } from "@/lib/payload-postgres-url";
import { isPostgresDatabase } from "@/lib/payload-postgres-url";
import type {
  TourSyncState,
  TourSyncStateUpdate,
  SquadRefreshTarget,
} from "@/lib/cricket/tour-sync-state-types";

async function getDbPool() {
  if (!isPostgresDatabase()) {
    throw new Error("tour_sync_state requires Postgres database");
  }
  const connectionString = getPostgresConnectionString();
  if (!connectionString) {
    throw new Error("DATABASE_URL not configured");
  }
  const { Pool } = await import("pg");
  return new Pool({ connectionString });
}

export async function readTourSyncState(
  tour_id: string,
): Promise<TourSyncState | null> {
  const pool = await getDbPool();
  try {
    const result = await pool.query(
      `SELECT * FROM "tour_sync_state" WHERE "tour_id" = $1`,
      [tour_id],
    );
    if (!result.rows.length) return null;
    return result.rows[0] as TourSyncState;
  } finally {
    await pool.end();
  }
}

export async function readAllTourSyncStates(): Promise<TourSyncState[]> {
  const pool = await getDbPool();
  try {
    const result = await pool.query(
      `SELECT * FROM "tour_sync_state" ORDER BY "updated_at" DESC`,
    );
    return (result.rows as TourSyncState[]) || [];
  } finally {
    await pool.end();
  }
}

export async function readActiveTourSyncStates(): Promise<TourSyncState[]> {
  const pool = await getDbPool();
  try {
    const result = await pool.query(
      `SELECT * FROM "tour_sync_state" WHERE "current_status" = $1 ORDER BY "updated_at" DESC`,
      ["active"],
    );
    return (result.rows as TourSyncState[]) || [];
  } finally {
    await pool.end();
  }
}

export async function upsertTourSyncState(
  update: TourSyncStateUpdate,
): Promise<TourSyncState> {
  const pool = await getDbPool();
  try {
    const existing = await pool.query(
      `SELECT "id" FROM "tour_sync_state" WHERE "tour_id" = $1`,
      [update.tour_id],
    );

    const exists = existing.rows.length > 0;

    if (exists) {
      const setClauses: string[] = [];
      const values: unknown[] = [];
      let paramIndex = 1;

      if (update.tour_slug !== undefined) {
        setClauses.push(`"tour_slug" = $${paramIndex++}`);
        values.push(update.tour_slug);
      }
      if (update.current_status !== undefined) {
        setClauses.push(`"current_status" = $${paramIndex++}`);
        values.push(update.current_status);
      }
      if (update.test_series_status !== undefined) {
        setClauses.push(`"test_series_status" = $${paramIndex++}`);
        values.push(update.test_series_status);
      }
      if (update.odi_series_status !== undefined) {
        setClauses.push(`"odi_series_status" = $${paramIndex++}`);
        values.push(update.odi_series_status);
      }
      if (update.t20_series_status !== undefined) {
        setClauses.push(`"t20_series_status" = $${paramIndex++}`);
        values.push(update.t20_series_status);
      }
      if (update.last_index_sync !== undefined) {
        setClauses.push(`"last_index_sync" = $${paramIndex++}`);
        values.push(update.last_index_sync);
      }
      if (update.last_squad_sync_test !== undefined) {
        setClauses.push(`"last_squad_sync_test" = $${paramIndex++}`);
        values.push(update.last_squad_sync_test);
      }
      if (update.last_squad_sync_odi !== undefined) {
        setClauses.push(`"last_squad_sync_odi" = $${paramIndex++}`);
        values.push(update.last_squad_sync_odi);
      }
      if (update.last_squad_sync_t20 !== undefined) {
        setClauses.push(`"last_squad_sync_t20" = $${paramIndex++}`);
        values.push(update.last_squad_sync_t20);
      }
      if (update.squad_import_complete_test !== undefined) {
        setClauses.push(`"squad_import_complete_test" = $${paramIndex++}`);
        values.push(update.squad_import_complete_test);
      }
      if (update.squad_import_complete_odi !== undefined) {
        setClauses.push(`"squad_import_complete_odi" = $${paramIndex++}`);
        values.push(update.squad_import_complete_odi);
      }
      if (update.squad_import_complete_t20 !== undefined) {
        setClauses.push(`"squad_import_complete_t20" = $${paramIndex++}`);
        values.push(update.squad_import_complete_t20);
      }

      setClauses.push(`"updated_at" = NOW()`);
      values.push(update.tour_id);

      const query = `UPDATE "tour_sync_state" SET ${setClauses.join(", ")} WHERE "tour_id" = $${paramIndex} RETURNING *`;

      const result = await pool.query(query, values);
      if (!result.rows.length) throw new Error(`Failed to update tour_sync_state for ${update.tour_id}`);
      return result.rows[0] as TourSyncState;
    }

    const now = new Date().toISOString();
    const insertQuery = `
      INSERT INTO "tour_sync_state" (
        "tour_id", "tour_slug", "current_status",
        "test_series_status", "odi_series_status", "t20_series_status",
        "last_index_sync",
        "squad_import_complete_test", "squad_import_complete_odi", "squad_import_complete_t20",
        "created_at", "updated_at"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `;

    const result = await pool.query(insertQuery, [
      update.tour_id,
      update.tour_slug,
      update.current_status ?? "active",
      update.test_series_status ?? null,
      update.odi_series_status ?? null,
      update.t20_series_status ?? null,
      update.last_index_sync ?? now,
      update.squad_import_complete_test ?? false,
      update.squad_import_complete_odi ?? false,
      update.squad_import_complete_t20 ?? false,
      now,
      now,
    ]);

    if (!result.rows.length) throw new Error(`Failed to insert tour_sync_state for ${update.tour_id}`);
    return result.rows[0] as TourSyncState;
  } finally {
    await pool.end();
  }
}

export async function deleteTourSyncState(tour_id: string): Promise<boolean> {
  const pool = await getDbPool();
  try {
    await pool.query(`DELETE FROM "tour_sync_state" WHERE "tour_id" = $1`, [tour_id]);
    return true;
  } finally {
    await pool.end();
  }
}

export async function getSquadRefreshTargets(): Promise<SquadRefreshTarget[]> {
  const activeTours = await readActiveTourSyncStates();
  const targets: SquadRefreshTarget[] = [];

  for (const tour of activeTours) {
    const matchTypes: Array<"test" | "odi" | "t20"> = [];

    if (
      tour.test_series_status === "upcoming" &&
      !tour.squad_import_complete_test
    ) {
      matchTypes.push("test");
    }
    if (
      tour.odi_series_status === "upcoming" &&
      !tour.squad_import_complete_odi
    ) {
      matchTypes.push("odi");
    }
    if (
      tour.t20_series_status === "upcoming" &&
      !tour.squad_import_complete_t20
    ) {
      matchTypes.push("t20");
    }

    if (matchTypes.length > 0) {
      targets.push({
        tour_id: tour.tour_id,
        tour_slug: tour.tour_slug,
        matchTypes,
      });
    }
  }

  return targets;
}
