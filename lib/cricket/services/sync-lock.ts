import { revalidatePath } from "next/cache";

import { CRICKET_SNAPSHOT_KEYS } from "@/lib/cricket/snapshot-keys";
import {
  readCricketSnapshot,
  snapshotAgeHours,
  upsertCricketSnapshot,
} from "@/lib/cricket/snapshot-db";

import type { SyncCricketOptions, SyncCricketResult } from "./sync-cricket-snapshots";
import { syncCricketSnapshots } from "./sync-cricket-snapshots";

/** Allow long tour builds — must exceed cron maxDuration. */
export const SYNC_LOCK_MAX_AGE_MINUTES = 20;

export type SyncLockSnapshot = {
  fetchedAt: string;
  inProgress: boolean;
  startedAt: string;
  lastResult?: SyncCricketResult | null;
  lastError?: string | null;
};

export async function readSyncLock(): Promise<SyncLockSnapshot | null> {
  return readCricketSnapshot<SyncLockSnapshot>(CRICKET_SNAPSHOT_KEYS.syncLock);
}

export async function tryAcquireSyncLock(): Promise<boolean> {
  const existing = await readSyncLock();
  if (existing?.inProgress) {
    const lockAgeMinutes = snapshotAgeHours(existing.startedAt) * 60;
    if (lockAgeMinutes < SYNC_LOCK_MAX_AGE_MINUTES) {
      return false;
    }
  }

  const startedAt = new Date().toISOString();
  await upsertCricketSnapshot(CRICKET_SNAPSHOT_KEYS.syncLock, "Cricket sync lock", {
    fetchedAt: startedAt,
    inProgress: true,
    startedAt,
    lastResult: null,
    lastError: null,
  });
  return true;
}

export async function releaseSyncLock(
  result?: SyncCricketResult,
  error?: string,
): Promise<void> {
  const fetchedAt = new Date().toISOString();
  await upsertCricketSnapshot(CRICKET_SNAPSHOT_KEYS.syncLock, "Cricket sync lock", {
    fetchedAt,
    inProgress: false,
    startedAt: fetchedAt,
    lastResult: result ?? null,
    lastError: error ?? null,
  });
}

export async function runCricketSyncInBackground(
  options: SyncCricketOptions,
): Promise<{ started: boolean; alreadyRunning: boolean }> {
  if (!(await tryAcquireSyncLock())) {
    return { started: false, alreadyRunning: true };
  }

  void (async () => {
    try {
      const result = await syncCricketSnapshots(options);
      await releaseSyncLock(result);
      // Background syncs (the nightly cron default, and now the admin panel button too) never
      // ran this before — pages could keep serving stale cached data indefinitely after a sync
      // that only ever ran in the background.
      if (result.ok) {
        try {
          revalidatePath("/");
          revalidatePath("/rankings");
          revalidatePath("/tours", "layout");
        } catch (revalidateErr) {
          console.warn("[cricket] revalidatePath after background sync failed:", revalidateErr);
        }
      }
      console.log("[cricket] background sync finished:", {
        ok: result.ok,
        tours: result.toursCount,
        tourDetails: result.tourDetailsCount,
        errors: result.errors.length,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sync failed";
      await releaseSyncLock(undefined, message);
      console.error("[cricket] background sync failed:", err);
    }
  })();

  return { started: true, alreadyRunning: false };
}
