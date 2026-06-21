import { after } from "next/server";

import {
  releaseSyncLock,
  tryAcquireSyncLock,
} from "@/lib/cricket/services/sync-lock";
import { syncCricketSnapshots } from "@/lib/cricket/services/sync-cricket-snapshots";
import { AUTO_SYNC_MAX_AGE_HOURS } from "@/lib/cricket/snapshot-keys";
import { getLastCricketSyncFetchedAt, snapshotAgeHours } from "@/lib/cricket/snapshot-db";
import { isNextProductionBuild } from "@/lib/next-build";
import { isPayloadConfigured } from "@/lib/payload-env";

let inFlightSync: Promise<void> | null = null;

async function runCricketSyncIfNeeded(): Promise<void> {
  if (inFlightSync) {
    await inFlightSync;
    return;
  }

  inFlightSync = (async () => {
    if (!(await tryAcquireSyncLock())) return;
    try {
      const result = await syncCricketSnapshots();
      await releaseSyncLock(result);
    } catch (err) {
      console.error("[cricket] auto-sync failed:", err);
      await releaseSyncLock(undefined, err instanceof Error ? err.message : "Sync failed");
    }
  })();

  try {
    await inFlightSync;
  } finally {
    inFlightSync = null;
  }
}

/** Run sync when snapshots are missing or older than 24 hours. */
export async function ensureCricketSnapshotsFresh(): Promise<void> {
  if (!isPayloadConfigured() || isNextProductionBuild()) return;

  const lastFetchedAt = await getLastCricketSyncFetchedAt();
  if (lastFetchedAt && snapshotAgeHours(lastFetchedAt) < AUTO_SYNC_MAX_AGE_HOURS) {
    return;
  }

  const hasData = lastFetchedAt !== null;
  if (!hasData) {
    await runCricketSyncIfNeeded();
    return;
  }

  after(async () => {
    await runCricketSyncIfNeeded();
  });
}
