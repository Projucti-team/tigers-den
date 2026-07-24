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
      if (update.espn_cricinfo_series_id !== undefined) {
        setClauses.push(`"espn_cricinfo_series_id" = $${paramIndex++}`);
        values.push(update.espn_cricinfo_series_id);
      }
      if (update.espn_league_id !== undefined) {
        setClauses.push(`"espn_league_id" = $${paramIndex++}`);
        values.push(update.espn_league_id);
      }
      if (update.espn_series_override !== undefined) {
        setClauses.push(`"espn_series_override" = $${paramIndex++}`);
        values.push(update.espn_series_override);
      }
      if (update.squad_story_url !== undefined) {
        setClauses.push(`"squad_story_url" = $${paramIndex++}`);
        values.push(update.squad_story_url);
      }
      if (update.manual_squad_text !== undefined) {
        setClauses.push(`"manual_squad_text" = $${paramIndex++}`);
        values.push(update.manual_squad_text);
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

/** Admin-pinned series id for a tour, if one has been set. */
export async function getTourSeriesOverride(tour_id: string): Promise<number | null> {
  const pool = await getDbPool();
  try {
    const result = await pool.query(
      `SELECT "espn_series_override" FROM "tour_sync_state" WHERE "tour_id" = $1`,
      [tour_id],
    );
    const value = result.rows[0]?.espn_series_override;
    return typeof value === "number" ? value : null;
  } finally {
    await pool.end();
  }
}

/** Set (or clear with null) the admin-pinned cricinfo series id for a tour. */
export async function setTourSeriesOverride(
  tour_id: string,
  cricinfoSeriesId: number | null,
): Promise<void> {
  const pool = await getDbPool();
  try {
    await pool.query(
      `UPDATE "tour_sync_state" SET "espn_series_override" = $2, "updated_at" = NOW() WHERE "tour_id" = $1`,
      [tour_id, cricinfoSeriesId],
    );
  } finally {
    await pool.end();
  }
}

/** Record which series a sync actually resolved fixtures/squads from — informational, overwritten every run. */
export async function recordResolvedTourSeries(
  tour_id: string,
  cricinfoSeriesId: number,
  espnLeagueId: number,
): Promise<void> {
  const pool = await getDbPool();
  try {
    await pool.query(
      `UPDATE "tour_sync_state"
       SET "espn_cricinfo_series_id" = $2, "espn_league_id" = $3, "updated_at" = NOW()
       WHERE "tour_id" = $1`,
      [tour_id, cricinfoSeriesId, espnLeagueId],
    );
  } finally {
    await pool.end();
  }
}

/** Admin-pinned squad story URL(s) for a tour, if set (newline-separated raw text). */
export async function getTourSquadStoryUrl(tour_id: string): Promise<string | null> {
  const pool = await getDbPool();
  try {
    const result = await pool.query(
      `SELECT "squad_story_url" FROM "tour_sync_state" WHERE "tour_id" = $1`,
      [tour_id],
    );
    const value = result.rows[0]?.squad_story_url;
    return typeof value === "string" && value.trim() ? value : null;
  } finally {
    await pool.end();
  }
}

/** Set (or clear with null) the admin-pinned squad story URL(s) for a tour. */
export async function setTourSquadStoryUrl(
  tour_id: string,
  squadStoryUrl: string | null,
): Promise<void> {
  const pool = await getDbPool();
  try {
    await pool.query(
      `UPDATE "tour_sync_state" SET "squad_story_url" = $2, "updated_at" = NOW() WHERE "tour_id" = $1`,
      [tour_id, squadStoryUrl],
    );
  } finally {
    await pool.end();
  }
}

/** Admin-pasted squad text for a tour, if set (one team per line, raw text). */
export async function getTourManualSquadText(tour_id: string): Promise<string | null> {
  const pool = await getDbPool();
  try {
    const result = await pool.query(
      `SELECT "manual_squad_text" FROM "tour_sync_state" WHERE "tour_id" = $1`,
      [tour_id],
    );
    const value = result.rows[0]?.manual_squad_text;
    return typeof value === "string" && value.trim() ? value : null;
  } finally {
    await pool.end();
  }
}

/** Set (or clear with null) the admin-pasted squad text for a tour. */
export async function setTourManualSquadText(
  tour_id: string,
  manualSquadText: string | null,
): Promise<void> {
  const pool = await getDbPool();
  try {
    await pool.query(
      `UPDATE "tour_sync_state" SET "manual_squad_text" = $2, "updated_at" = NOW() WHERE "tour_id" = $1`,
      [tour_id, manualSquadText],
    );
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
  console.log(`[cricket] getSquadRefreshTargets: found ${activeTours.length} active tour(s)`);

  const targets: SquadRefreshTarget[] = [];

  for (const tour of activeTours) {
    const matchTypes: Array<"test" | "odi" | "t20"> = [];

    if (
      (tour.test_series_status === "upcoming" || tour.test_series_status === "active") &&
      !tour.squad_import_complete_test
    ) {
      matchTypes.push("test");
    }
    if (
      (tour.odi_series_status === "upcoming" || tour.odi_series_status === "active") &&
      !tour.squad_import_complete_odi
    ) {
      matchTypes.push("odi");
    }
    if (
      (tour.t20_series_status === "upcoming" || tour.t20_series_status === "active") &&
      !tour.squad_import_complete_t20
    ) {
      matchTypes.push("t20");
    }

    if (matchTypes.length > 0) {
      console.log(`[cricket] ${tour.tour_slug}: needs refresh for ${matchTypes.join(", ")}`);
      targets.push({
        tour_id: tour.tour_id,
        tour_slug: tour.tour_slug,
        matchTypes,
      });
    }
  }

  return targets;
}
