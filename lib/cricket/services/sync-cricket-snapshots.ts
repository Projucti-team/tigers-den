import { enrichIccSnapshotPlayerImages } from "@/lib/cricket/player-images";
import { ensureCountriesSeeded, repairInvalidPlayerProfiles } from "@/lib/cricket/players/registry";
import { fetchAllIccRankingsFromSportz } from "@/lib/cricket/providers/icc-sportz";
import type { IccRankingsSnapshot } from "@/lib/cricket/providers/icc-sportz";
import { fetchWtcStandingsFromEspn } from "@/lib/cricket/providers/wtc-espn";
import { writeIccRankingsSnapshot } from "@/lib/cricket/icc-rankings-store";
import { writeWtcStandingsSnapshot } from "@/lib/cricket/wtc-store";
import {
  buildRankingsShowcaseLive,
  logRankingsShowcaseStats,
} from "@/lib/cricket/services/build-rankings-showcase";
import { buildTourDetailLive, toTourDetailSnapshot } from "@/lib/cricket/services/build-tour-detail";
import { applyEspnTourSquads, refreshEspnTourSquads } from "@/lib/cricket/providers/espn-squads";
import {
  beginCricApiSyncSession,
  isCricApiBlocked,
  isCricApiConfigured,
  prefetchMatchesForSync,
} from "@/lib/cricket/providers/cricapi";
import { buildToursIndexLive } from "@/lib/cricket/services/build-tours-index";
import {
  isCricApiRateLimited,
  shouldKeepPreviousToursSnapshot,
} from "@/lib/cricket/services/tour-sync-policy";
import { scrapeBangladeshLastMatch } from "@/lib/cricket/services/bangladesh-last-match";
import { scrapeBangladeshUpcomingMatches } from "@/lib/cricket/services/bangladesh-upcoming-matches";
import type { TourDetailSnapshot, ToursIndexSnapshot } from "@/lib/cricket/snapshot-types";
import { CRICKET_SNAPSHOT_KEYS } from "@/lib/cricket/snapshot-keys";
import {
  deleteCricketSnapshotsExcept,
  readCricketSnapshot,
  snapshotAgeHours,
  upsertCricketSnapshot,
} from "@/lib/cricket/snapshot-db";
import type { LiveMatchSummary, Tour } from "@/lib/cricket/types";
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

export type SyncCricketOptions = {
  /** Re-fetch CricAPI data even when the tours snapshot is younger than 24h. */
  force?: boolean;
};

/**
 * Slightly under 24h so the nightly cron (every 24h) still refreshes —
 * by completion time the previous snapshot is ~23.9h old at the next run.
 */
const CRICAPI_FRESH_MAX_AGE_HOURS = 23;

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

async function refreshTourSquadsOnly(
  tour: Tour,
  keysToKeep: Set<string>,
): Promise<boolean> {
  const slug = tourSlug(tour);
  const key = CRICKET_SNAPSHOT_KEYS.tourDetail(slug);
  keysToKeep.add(key);

  const cachedDetail = await readCricketSnapshot<TourDetailSnapshot>(key);
  if (!cachedDetail) return false;

  const { squads, warnings: squadWarnings } = await refreshEspnTourSquads(tour);
  const withFreshSquads = applyEspnTourSquads(cachedDetail, squads, squadWarnings);
  await upsertCricketSnapshot(
    key,
    `Tour: ${tour.name}`,
    {
      ...withFreshSquads,
      slug,
      fetchedAt: new Date().toISOString(),
    } satisfies TourDetailSnapshot,
  );
  return true;
}

async function syncTourDetails(
  tours: Tour[],
  tourWarnings: string[],
  keysToKeep: Set<string>,
  options: { squadsOnly: boolean },
): Promise<{ built: number; errors: string[] }> {
  const detailErrors: string[] = [];
  let built = 0;

  for (const tour of tours) {
    const slug = tourSlug(tour);
    const key = CRICKET_SNAPSHOT_KEYS.tourDetail(slug);
    keysToKeep.add(key);

    try {
      if (options.squadsOnly) {
        const refreshed = await refreshTourSquadsOnly(tour, keysToKeep);
        if (!refreshed) {
          const detail = await buildTourDetailLive(tour, tourWarnings);
          await upsertCricketSnapshot(
            key,
            `Tour: ${tour.name}`,
            toTourDetailSnapshot(detail, slug),
          );
        }
        built += 1;
        continue;
      }

      const detail = await buildTourDetailLive(tour, tourWarnings);
      await upsertCricketSnapshot(
        key,
        `Tour: ${tour.name}`,
        toTourDetailSnapshot(detail, slug),
      );
      built += 1;
    } catch (e) {
      detailErrors.push(`Tour ${slug}: ${e instanceof Error ? e.message : "failed"}`);
    }
  }

  return { built, errors: detailErrors };
}

/**
 * Nightly job (3:00 AM BDT via Coolify/server cron): refresh sources, build page snapshots, save to DB.
 */
export async function syncCricketSnapshots(
  options?: SyncCricketOptions,
): Promise<SyncCricketResult> {
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
        "PAYLOAD_SECRET is not set — add it in production environment variables and redeploy.",
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
        "No database configured — set DATABASE_URI (or POSTGRES_URL/DATABASE_URL if using Postgres).",
      ],
    };
  }

  try {
    await ensureSqliteCricketSnapshotsTable();
    await ensureCountriesSeeded();
    const repairedPlayers = await repairInvalidPlayerProfiles();
    if (repairedPlayers > 0) {
      warnings.push(`Cleared ${repairedPlayers} invalid cached player profile or headshot URLs.`);
    }
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

  // CricAPI daily-quota guard: if the last tours snapshot is younger than ~24h,
  // reuse it and skip every CricAPI call (rankings/WTC below don't use CricAPI).
  const previousTours = await readCricketSnapshot<ToursIndexSnapshot>(
    CRICKET_SNAPSHOT_KEYS.toursIndex,
  );
  const previousToursAgeHours = previousTours?.fetchedAt
    ? snapshotAgeHours(previousTours.fetchedAt)
    : Number.POSITIVE_INFINITY;
  const skipCricApi =
    !options?.force &&
    (previousTours?.tours?.length ?? 0) > 0 &&
    previousToursAgeHours < CRICAPI_FRESH_MAX_AGE_HOURS;

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

  if (!skipCricApi && isCricApiConfigured()) {
    try {
      prefetchedMatches = await prefetchMatchesForSync();
    } catch (e) {
      const message = e instanceof Error ? e.message : "CricAPI prefetch failed";
      warnings.push(message);
    }
  }

  if (!skipCricApi) {
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
    console.log("[cricket] rankings showcase saved:");
    logRankingsShowcaseStats(rankings);
    warnings.push(...rankings.warnings);
  } catch (e) {
    errors.push(`Rankings showcase: ${e instanceof Error ? e.message : "failed"}`);
  }

  let toursCount = 0;
  let tourDetailsCount = 0;

  if (skipCricApi && previousTours) {
    toursCount = previousTours.tours.length;
    warnings.push(
      `Tours snapshot is ${previousToursAgeHours.toFixed(1)}h old — skipped CricAPI, refreshed squads from ESPN.`,
    );

    const detailResult = await syncTourDetails(previousTours.tours, previousTours.warnings, keysToKeep, {
      squadsOnly: true,
    });
    tourDetailsCount = detailResult.built;
    errors.push(...detailResult.errors);
  } else {
    try {
      const toursIndex = await buildToursIndexLive({ prefetchedMatches });
      warnings.push(...toursIndex.warnings);

      const cricApiBlocked =
        isCricApiBlocked() || isCricApiRateLimited(toursIndex.warnings);
      const keepPrevious = shouldKeepPreviousToursSnapshot(
        previousTours,
        toursIndex,
        cricApiBlocked,
      );

      let toursToProcess = toursIndex;
      let squadsOnly = false;

      if (keepPrevious && previousTours) {
        toursToProcess = previousTours;
        squadsOnly = true;
        toursCount = previousTours.tours.length;
        warnings.push(
          `CricAPI quota/rate-limited — kept ${previousTours.tours.length} tour(s) from the last full sync (${previousToursAgeHours.toFixed(1)}h ago). Refreshed squads from ESPN.`,
        );
      } else if (toursIndex.tours.length === 0) {
        if (previousTours?.tours?.length) {
          toursToProcess = previousTours;
          squadsOnly = true;
          toursCount = previousTours.tours.length;
          warnings.push("CricAPI returned no tours — kept the previous tours snapshot.");
        } else if (cricApiBlocked) {
          const espnIndex = await buildToursIndexLive({ espnOnly: true });
          if (espnIndex.tours.length > 0) {
            toursToProcess = espnIndex;
            await upsertCricketSnapshot(
              CRICKET_SNAPSHOT_KEYS.toursIndex,
              "Upcoming tours index",
              espnIndex,
            );
            toursCount = espnIndex.tours.length;
            warnings.push(
              `Built tours index from ESPNcricinfo (${espnIndex.tours.length} tour(s)) — no CricAPI data available.`,
            );
          } else {
            errors.push(
              "Tours index: CricAPI blocked and ESPNcricinfo returned no tours.",
            );
          }
        }
      } else {
        await upsertCricketSnapshot(
          CRICKET_SNAPSHOT_KEYS.toursIndex,
          "Upcoming tours index",
          toursIndex,
        );
        toursCount = toursIndex.tours.length;
      }

      const detailResult = await syncTourDetails(
        toursToProcess.tours,
        toursToProcess.warnings,
        keysToKeep,
        { squadsOnly },
      );
      tourDetailsCount = detailResult.built;
      errors.push(...detailResult.errors);
    } catch (e) {
      errors.push(`Tours index: ${e instanceof Error ? e.message : "failed"}`);
    }
  }

  // Never prune when we ended up with zero tours — a failed fetch must not delete good pages.
  if (toursCount > 0) {
    const pruned = await deleteCricketSnapshotsExcept(keysToKeep);
    if (pruned > 0) {
      warnings.push(`Removed ${pruned} outdated tour snapshot(s).`);
    }
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
