import { after } from "next/server";

import { syncCricketSnapshots } from "@/lib/cricket/services/sync-cricket-snapshots";
import { CRICKET_SNAPSHOT_KEYS, AUTO_SYNC_MAX_AGE_HOURS } from "@/lib/cricket/snapshot-keys";
import {
  getLastCricketSyncFetchedAt,
  readCricketSnapshot,
  snapshotAgeHours,
  upsertCricketSnapshot,
} from "@/lib/cricket/snapshot-db";
import { isNextProductionBuild } from "@/lib/next-build";
import { isPayloadConfigured } from "@/lib/payload-env";

const SYNC_LOCK_MAX_AGE_MINUTES = 15;

type SyncLockSnapshot = {
  fetchedAt: string;
  inProgress: boolean;
  startedAt: string;
};

let inFlightSync: Promise<void> | null = null;

async function tryAcquireSyncLock(): Promise<boolean> {
  const existing = await readCricketSnapshot<SyncLockSnapshot>(CRICKET_SNAPSHOT_KEYS.syncLock);
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
  });
  return true;
}

async function releaseSyncLock(): Promise<void> {
  const fetchedAt = new Date().toISOString();
  await upsertCricketSnapshot(CRICKET_SNAPSHOT_KEYS.syncLock, "Cricket sync lock", {
    fetchedAt,
    inProgress: false,
    startedAt: fetchedAt,
  });
}

async function runCricketSyncIfNeeded(): Promise<void> {
  if (inFlightSync) {
    await inFlightSync;
    return;
  }

  inFlightSync = (async () => {
    if (!(await tryAcquireSyncLock())) return;
    try {
      await syncCricketSnapshots();
    } catch (err) {
      console.error("[cricket] auto-sync failed:", err);
    } finally {
      await releaseSyncLock();
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
