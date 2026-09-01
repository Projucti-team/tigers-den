import { CRICKET_SNAPSHOT_KEYS, isTourDetailSnapshotKey, tourDetailSlugFromKey } from "@/lib/cricket/snapshot-keys";
import { isNextProductionBuild } from "@/lib/next-build";
import { hasPersistedDatabase } from "@/lib/payload-db";
import { getPayloadClient } from "@/lib/payload";
import { isPayloadConfigured } from "@/lib/payload-env";

function isMissingRelationError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /relation .* does not exist/i.test(message) || /no such table/i.test(message);
}

const MAX_SNAPSHOT_AGE_HOURS = 36;

export function snapshotAgeHours(fetchedAt: string): number {
  const ageMs = Date.now() - new Date(fetchedAt).getTime();
  return ageMs / (1000 * 60 * 60);
}

export function staleSnapshotWarning(fetchedAt: string, label: string): string | null {
  const ageH = snapshotAgeHours(fetchedAt);
  if (ageH > MAX_SNAPSHOT_AGE_HOURS) {
    return `${label} data is ${Math.round(ageH)}h old — nightly refresh may have failed.`;
  }
  return null;
}

/** Latest `fetchedAt` from tours index (preferred) or rankings showcase. */
export async function getLastCricketSyncFetchedAt(): Promise<string | null> {
  if (!isPayloadConfigured()) return null;

  for (const key of [CRICKET_SNAPSHOT_KEYS.toursIndex, CRICKET_SNAPSHOT_KEYS.rankingsShowcase] as const) {
    const snapshot = await readCricketSnapshot<{ fetchedAt: string }>(key);
    if (snapshot?.fetchedAt) return snapshot.fetchedAt;
  }
  return null;
}

export async function upsertCricketSnapshot(
  key: string,
  label: string,
  data: unknown,
): Promise<string> {
  if (!isPayloadConfigured()) {
    return new Date().toISOString();
  }

  const payload = await getPayloadClient();
  const fetchedAt = new Date().toISOString();

  const existing = await payload.find({
    collection: "cricket-snapshots",
    where: { key: { equals: key } },
    limit: 1,
    overrideAccess: true,
  });

  const row = existing.docs[0];
  if (row) {
    await payload.update({
      collection: "cricket-snapshots",
      id: row.id,
      overrideAccess: true,
      data: { key, label, fetchedAt, data },
    });
  } else {
    await payload.create({
      collection: "cricket-snapshots",
      overrideAccess: true,
      data: { key, label, fetchedAt, data },
    });
  }

  return fetchedAt;
}

function canReadSnapshotsDuringBuild(): boolean {
  if (!isNextProductionBuild()) return true;
  return hasPersistedDatabase();
}

export async function readCricketSnapshot<T extends { fetchedAt: string }>(
  key: string,
): Promise<T | null> {
  if (!isPayloadConfigured() || !canReadSnapshotsDuringBuild()) return null;

  try {
    const payload = await getPayloadClient();
    const result = await payload.find({
      collection: "cricket-snapshots",
      where: { key: { equals: key } },
      limit: 1,
      overrideAccess: true,
    });

    const doc = result.docs[0] as { data?: T; fetchedAt?: string } | undefined;
    if (!doc?.data || typeof doc.data !== "object") return null;

    const data = doc.data as T;
    if (!data.fetchedAt && doc.fetchedAt) {
      data.fetchedAt = String(doc.fetchedAt);
    }
    return data;
  } catch (err) {
    if (isMissingRelationError(err)) return null;
    throw err;
  }
}

/**
 * Slugs of tours that actually have a built, non-empty detail page -- i.e. safe to link to
 * from the nav dropdown / homepage cards. Discovery (tours-index) is intentionally loose (any
 * ESPN/CricAPI series that loosely mentions Bangladesh) and doesn't guarantee a detail page
 * ever got built for a given tour, or that the build didn't come back with zero matches --
 * this is one query, not one-per-tour, so it's cheap enough to call on every nav render.
 */
export async function readTourDetailSlugsWithMatches(): Promise<Set<string>> {
  const slugs = new Set<string>();
  if (!isPayloadConfigured()) return slugs;

  try {
    const payload = await getPayloadClient();
    const result = await payload.find({
      collection: "cricket-snapshots",
      limit: 500,
      overrideAccess: true,
    });

    for (const doc of result.docs as { key?: string; data?: { matches?: unknown[] } }[]) {
      const key = doc.key ?? "";
      if (!isTourDetailSnapshotKey(key)) continue;
      if (!Array.isArray(doc.data?.matches) || doc.data.matches.length === 0) continue;
      const slug = tourDetailSlugFromKey(key);
      if (slug) slugs.add(slug);
    }
  } catch (err) {
    if (!isMissingRelationError(err)) throw err;
  }

  return slugs;
}

/**
 * Slugs of every tour that has *a* built detail page, whether or not it has matches yet -- for
 * the nav dropdown, which just needs to avoid a real 404 (no snapshot doc at all). A page with
 * zero matches still renders fine (squads/venue info, "fixtures TBC"), unlike readTourDetailSlugsWithMatches()'s
 * stricter set (used for homepage cards, where a "0 matches" card would look broken). Distinguishing
 * these two closes a gap where a real, discovered series -- with a working detail page -- was
 * silently missing from the nav dropdown just because its match-level data hadn't synced yet,
 * even though the /tours index page already linked to it directly.
 */
export async function readTourDetailSlugsWithSnapshot(): Promise<Set<string>> {
  const slugs = new Set<string>();
  if (!isPayloadConfigured()) return slugs;

  try {
    const payload = await getPayloadClient();
    const result = await payload.find({
      collection: "cricket-snapshots",
      limit: 500,
      overrideAccess: true,
    });

    for (const doc of result.docs as { key?: string }[]) {
      const key = doc.key ?? "";
      if (!isTourDetailSnapshotKey(key)) continue;
      const slug = tourDetailSlugFromKey(key);
      if (slug) slugs.add(slug);
    }
  } catch (err) {
    if (!isMissingRelationError(err)) throw err;
  }

  return slugs;
}

export async function deleteCricketSnapshotsExcept(keysToKeep: Set<string>): Promise<number> {
  if (!isPayloadConfigured()) return 0;

  const payload = await getPayloadClient();
  const result = await payload.find({
    collection: "cricket-snapshots",
    limit: 200,
    overrideAccess: true,
  });

  let removed = 0;
  for (const doc of result.docs) {
    const key = String((doc as { key?: string }).key ?? "");
    if (!keysToKeep.has(key) && key.startsWith("tour-detail:")) {
      await payload.delete({
        collection: "cricket-snapshots",
        id: doc.id,
        overrideAccess: true,
      });
      removed += 1;
    }
  }
  return removed;
}
