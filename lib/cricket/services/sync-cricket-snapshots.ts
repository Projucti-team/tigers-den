import { enrichIccSnapshotPlayerImages } from "@/lib/cricket/player-images";
import { fetchAllIccRankingsFromSportz } from "@/lib/cricket/providers/icc-sportz";
import type { IccRankingsSnapshot } from "@/lib/cricket/providers/icc-sportz";
import { fetchWtcStandingsFromEspn } from "@/lib/cricket/providers/wtc-espn";
import { writeIccRankingsSnapshot } from "@/lib/cricket/icc-rankings-store";
import { writeWtcStandingsSnapshot } from "@/lib/cricket/wtc-store";
import { buildRankingsShowcaseLive } from "@/lib/cricket/services/build-rankings-showcase";
import { buildTourDetailLive, toTourDetailSnapshot } from "@/lib/cricket/services/build-tour-detail";
import {
  beginCricApiSyncSession,
  isCricApiBlocked,
  isCricApiConfigured,
  prefetchMatchesForSync,
} from "@/lib/cricket/providers/cricapi";
import { buildToursIndexLive } from "@/lib/cricket/services/build-tours-index";
import { scrapeBangladeshLastMatch } from "@/lib/cricket/services/bangladesh-last-match";
import { scrapeBangladeshUpcomingMatches } from "@/lib/cricket/services/bangladesh-upcoming-matches";
import type { ToursIndexSnapshot } from "@/lib/cricket/snapshot-types";
import { CRICKET_SNAPSHOT_KEYS } from "@/lib/cricket/snapshot-keys";
import {
  deleteCricketSnapshotsExcept,
  readCricketSnapshot,
  upsertCricketSnapshot,
} from "@/lib/cricket/snapshot-db";
import type { LiveMatchSummary } from "@/lib/cricket/types";
import { tourSlug } from "@/lib/cricket/tour-slug";
import type { WtcStandingsSnapshot } from "@/lib/cricket/types";
import { hasPersistedDatabase } from "@/lib/payload-db";
import { ensureSqliteCricketSnapshotsTable } from "@/lib/payload-ensure-sqlite-schema";
import { isPayloadConfigured } from "@/lib/payload";
export type SyncCricketResult = {
  ok: boolean;
  fetchedAt: string;
  toursCount: number;
  tourDetailsCount: number;
  warnings: string[];
  errors: string[];
};

async function refreshIccRankingsSource(): Promise<IccRankingsSnapshot> {
  let snapshot = await fetchAllIccRankingsFromSportz();
  snapshot = await enrichIccSnapshotPlayerImages(snapshot);
  await writeIccRankingsSnapshot(snapshot);
  return snapshot;
}

async function refreshWtcSource(): Promise<WtcStandingsSnapshot> {
  const snapshot = await fetchWtcStandingsFromEspn();
  await writeWtcStandingsSnapshot(snapshot);
  return snapshot;
}

/**
 * Nightly job (~3:00 AM BDT via Vercel cron): refresh sources, build page snapshots, save to DB.
 * On Vercel, `data/*.json` is read-only — snapshots are stored in Postgres instead.
 */
export async function syncCricketSnapshots(): Promise<SyncCricketResult> {
  const warnings: string[] = [];
  const errors: string[] = [];

  if (!isPayloadConfigured()) {
    return {
      ok: false,
      fetchedAt: new Date().toISOString(),
      toursCount: 0,
      tourDetailsCount: 0,
      warnings: [],
      errors: [
        "PAYLOAD_SECRET is not set — add it in Vercel Environment Variables (Production) and redeploy.",
      ],
    };
  }

  if (!hasPersistedDatabase()) {
    return {
      ok: false,
      fetchedAt: new Date().toISOString(),
      toursCount: 0,
      tourDetailsCount: 0,
      warnings: [],
      errors: [
        "No database configured — set DATABASE_URI (VPS/Docker) or POSTGRES_URL (Vercel).",
      ],
    };
  }

  try {
    await ensureSqliteCricketSnapshotsTable();
  } catch (e) {
    return {
      ok: false,
      fetchedAt: new Date().toISOString(),
      toursCount: 0,
      tourDetailsCount: 0,
      warnings: [],
      errors: [
        `Database schema: ${e instanceof Error ? e.message : "could not ensure cricket_snapshots table"}`,
      ],
    };
  }

  const keysToKeep = new Set<string>([
    CRICKET_SNAPSHOT_KEYS.rankingsShowcase,
    CRICKET_SNAPSHOT_KEYS.toursIndex,
    CRICKET_SNAPSHOT_KEYS.lastMatch,
    CRICKET_SNAPSHOT_KEYS.upcomingMatches,
  ]);

  let iccSnapshot: IccRankingsSnapshot | null = null;
  let wtcSnapshot: WtcStandingsSnapshot | null = null;

  try {
    iccSnapshot = await refreshIccRankingsSource();
  } catch (e) {
    errors.push(`ICC rankings: ${e instanceof Error ? e.message : "failed"}`);
  }

  try {
    wtcSnapshot = await refreshWtcSource();
  } catch (e) {
    errors.push(`WTC standings: ${e instanceof Error ? e.message : "failed"}`);
  }

  beginCricApiSyncSession();
  let prefetchedMatches: LiveMatchSummary[] = [];

  if (isCricApiConfigured()) {
    try {
      prefetchedMatches = await prefetchMatchesForSync();
    } catch (e) {
      const message = e instanceof Error ? e.message : "CricAPI prefetch failed";
      warnings.push(message);
    }
  }

  try {
    const lastMatch = await scrapeBangladeshLastMatch(prefetchedMatches);
    if (lastMatch) {
      await upsertCricketSnapshot(
        CRICKET_SNAPSHOT_KEYS.lastMatch,
        "Bangladesh last completed match",
        lastMatch,
      );
    }
  } catch (e) {
    errors.push(`Last match: ${e instanceof Error ? e.message : "failed"}`);
  }

  try {
    const upcoming = await scrapeBangladeshUpcomingMatches(prefetchedMatches);
    if (upcoming) {
      await upsertCricketSnapshot(
        CRICKET_SNAPSHOT_KEYS.upcomingMatches,
        "Bangladesh upcoming matches",
        upcoming,
      );
    }
  } catch (e) {
    errors.push(`Upcoming matches: ${e instanceof Error ? e.message : "failed"}`);
  }

  try {
    const rankings = await buildRankingsShowcaseLive({
      icc: iccSnapshot,
      wtc: wtcSnapshot,
    });
    await upsertCricketSnapshot(
      CRICKET_SNAPSHOT_KEYS.rankingsShowcase,
      "ICC rankings showcase",
      rankings,
    );
    warnings.push(...rankings.warnings);
  } catch (e) {
    errors.push(`Rankings showcase: ${e instanceof Error ? e.message : "failed"}`);
  }

  let toursCount = 0;
  let tourDetailsCount = 0;

  try {
    const toursIndex = await buildToursIndexLive({ prefetchedMatches });
    warnings.push(...toursIndex.warnings);
    const rateLimited = isCricApiBlocked() || toursIndex.warnings.some((w) => /blocked/i.test(w));
    let toursToProcess = toursIndex;

    if (rateLimited && toursIndex.tours.length === 0) {
      const previous = await readCricketSnapshot<ToursIndexSnapshot>(CRICKET_SNAPSHOT_KEYS.toursIndex);
      if (previous?.tours?.length) {
        toursToProcess = previous;
        toursCount = previous.tours.length;
        warnings.push(
          "CricAPI rate-limited — kept the previous tours snapshot. Wait ~15 minutes, then sync again.",
        );
      } else {
        errors.push(
          "Tours index: CricAPI rate-limited (Blocked for 15 minutes). Wait and run sync again.",
        );
      }
    } else {
      await upsertCricketSnapshot(
        CRICKET_SNAPSHOT_KEYS.toursIndex,
        "Upcoming tours index",
        toursIndex,
      );
      toursCount = toursIndex.tours.length;

      if (process.env.CRICKET_DATA_API_KEY?.trim() && toursCount === 0) {
        const fetchFailure = toursIndex.warnings.find((w) =>
          /failed|HTTP|CricAPI|quota|unavailable|blocked|invalid api|rate/i.test(w),
        );
        if (fetchFailure) {
          errors.push(`Tours index: ${fetchFailure}`);
        } else if (!toursIndex.warnings.length) {
          warnings.push(
            "No upcoming Bangladesh series returned from CricAPI — key may be invalid or tours not listed yet.",
          );
        }
      }
    }

    for (const tour of toursToProcess.tours) {
      const slug = tourSlug(tour);
      const key = CRICKET_SNAPSHOT_KEYS.tourDetail(slug);
      keysToKeep.add(key);

      if (rateLimited) {
        tourDetailsCount += 1;
        continue;
      }

      try {
        const detail = await buildTourDetailLive(tour, toursToProcess.warnings);
        await upsertCricketSnapshot(
          key,
          `Tour: ${tour.name}`,
          toTourDetailSnapshot(detail, slug),
        );
        tourDetailsCount += 1;
      } catch (e) {
        errors.push(`Tour ${slug}: ${e instanceof Error ? e.message : "failed"}`);
      }
    }
  } catch (e) {
    errors.push(`Tours index: ${e instanceof Error ? e.message : "failed"}`);
  }

  const pruned = await deleteCricketSnapshotsExcept(keysToKeep);
  if (pruned > 0) {
    warnings.push(`Removed ${pruned} outdated tour snapshot(s).`);
  }

  return {
    ok: errors.length === 0,
    fetchedAt: new Date().toISOString(),
    toursCount,
    tourDetailsCount,
    warnings: [...new Set(warnings)],
    errors,
  };
}

/** Log summary for CLI / cron. */
export function logSyncResult(result: SyncCricketResult): void {
  console.log(`Cricket sync finished at ${result.fetchedAt}`);
  console.log(`  Tours: ${result.toursCount}, tour detail pages: ${result.tourDetailsCount}`);
  if (result.warnings.length) {
    console.log("Warnings:");
    for (const w of result.warnings) console.log(`  - ${w}`);
  }
  if (result.errors.length) {
    console.error("Errors:");
    for (const e of result.errors) console.error(`  - ${e}`);
  }
}
