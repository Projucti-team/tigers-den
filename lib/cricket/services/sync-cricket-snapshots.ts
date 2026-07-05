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
import {
  applyEspnTourSquads,
  refreshEspnTourSquads,
} from "@/lib/cricket/providers/espn-squads";
import {
  enrichMatchFixtureTimes,
  espnLeagueForTour,
} from "@/lib/cricket/providers/espn-fixtures";
import { buildTourMatchesFromEspnSeries } from "@/lib/cricket/providers/espn-live";
import {
  beginCricApiSyncSession,
  getCricApiKeyWarnings,
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
import {
  formatTourDetailAuditIssues,
  auditTourDetailSnapshot,
} from "@/lib/cricket/tour-detail-audit";
import { filterMatchesForTour, isUmbrellaTourName, squadBelongsToTour } from "@/lib/cricket/tour-identity";
import { sanitizeTourSnapshotForRead } from "@/lib/cricket/tour-detail-sanitize";
import { tourSlug } from "@/lib/cricket/tour-slug";
import {
  pruneTourDetailSnapshots,
  writeTourDetailSnapshot,
} from "@/lib/cricket/tour-detail-store";
import { resolveTourVenues } from "@/lib/cricket/venues";
import { sortMatchesByDate } from "@/lib/cricket/match-sort";
import type { WtcStandingsSnapshot } from "@/lib/cricket/types";
import { hasPersistedDatabase } from "@/lib/payload-db";
import { ensureSqliteCricketSnapshotsTable } from "@/lib/payload-ensure-sqlite-schema";
import { isPayloadConfigured } from "@/lib/payload-env";
import {
  resolveCricketSyncJobs,
  type CricketSyncJobId,
  type CricketSyncJobSelection,
} from "@/lib/cricket/sync-jobs";
import {
  initializeTourSyncState,
  updateTourFormatStatus,
  markFinishedTours,
} from "@/lib/cricket/services/update-tour-sync-state";
import { refreshSquadsForActiveTours } from "@/lib/cricket/services/refresh-squads-for-active-tours";

export type SyncCricketResult = {
  ok: boolean;
  fetchedAt: string;
  toursCount: number;
  tourDetailsCount: number;
  warnings: string[];
  errors: string[];
  jobsRun: CricketSyncJobId[];
};

export type SyncCricketOptions = {
  /** Re-fetch CricAPI data even when the tours snapshot is younger than 24h. */
  force?: boolean;
  /** Which steps to run. Default: all jobs (full nightly sync). */
  jobs?: CricketSyncJobSelection[];
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

async function persistTourDetail(slug: string, tour: Tour, detail: TourDetailSnapshot): Promise<void> {
  const sanitized = sanitizeTourSnapshotForRead(tour, detail);
  const squads = detail.squads.filter((squad) => squadBelongsToTour(squad, tour));
  const detailForAudit: TourDetailSnapshot = {
    ...detail,
    matches: sanitized.matches,
    venues: sanitized.venues,
    squads,
  };

  const auditIssues = auditTourDetailSnapshot(detailForAudit);
  const snapshot: TourDetailSnapshot = auditIssues.length
    ? {
        ...detailForAudit,
        warnings: [
          ...detailForAudit.warnings,
          ...formatTourDetailAuditIssues(auditIssues).map((message) => `Audit: ${message}`),
        ],
      }
    : detailForAudit;

  await upsertCricketSnapshot(keyForTourDetail(slug), `Tour: ${tour.name}`, snapshot);
  await writeTourDetailSnapshot(slug, snapshot);
}

function keyForTourDetail(slug: string): string {
  return CRICKET_SNAPSHOT_KEYS.tourDetail(slug);
}

async function refreshUmbrellaTourMatches(tour: Tour, cached: TourDetailSnapshot): Promise<TourDetailSnapshot["matches"]> {
  const validCached = filterMatchesForTour(tour, cached.matches);
  if (!isUmbrellaTourName(tour.name)) return validCached;

  const league = await espnLeagueForTour(tour);
  if (!league) return validCached;

  const espnMatches = await buildTourMatchesFromEspnSeries(tour, league);
  if (!espnMatches.length) return validCached;

  return sortMatchesByDate(await enrichMatchFixtureTimes(espnMatches, { tour }));
}

async function refreshTourSquadsOnly(
  tour: Tour,
  keysToKeep: Set<string>,
): Promise<boolean> {
  const slug = tourSlug(tour);
  const key = keyForTourDetail(slug);
  keysToKeep.add(key);

  const cachedDetail = await readCricketSnapshot<TourDetailSnapshot>(key);
  if (!cachedDetail) return false;

  const matches = await refreshUmbrellaTourMatches(tour, cachedDetail);
  const venues = await resolveTourVenues(matches, {
    cached: cachedDetail.venues,
    persist: true,
  });
  const { squads, warnings: squadWarnings } = await refreshEspnTourSquads(tour);
  const withFreshSquads = applyEspnTourSquads(
    {
      ...cachedDetail,
      matches,
      venues,
    },
    squads,
    squadWarnings,
  );
  const snapshot = {
    ...withFreshSquads,
    slug,
    fetchedAt: new Date().toISOString(),
  } satisfies TourDetailSnapshot;

  await persistTourDetail(slug, tour, snapshot);
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
    const key = keyForTourDetail(slug);
    keysToKeep.add(key);

    try {
      if (options.squadsOnly) {
        const refreshed = await refreshTourSquadsOnly(tour, keysToKeep);
        if (!refreshed) {
          const detail = toTourDetailSnapshot(await buildTourDetailLive(tour, tourWarnings), slug);
          await persistTourDetail(slug, tour, detail);
        }
        built += 1;
        continue;
      }

      const detail = toTourDetailSnapshot(await buildTourDetailLive(tour, tourWarnings), slug);
      await persistTourDetail(slug, tour, detail);
      built += 1;
    } catch (e) {
      detailErrors.push(`Tour ${slug}: ${e instanceof Error ? e.message : "failed"}`);
    }
  }

  return { built, errors: detailErrors };
}

/**
 * Sync ICC rankings + WTC standings, build rankings showcase snapshot.
 */
export async function syncRankings(options?: SyncCricketOptions): Promise<SyncCricketResult> {
  const warnings: string[] = [];
  const errors: string[] = [];

  if (!isPayloadConfigured()) {
    return {
      ok: false,
      fetchedAt: new Date().toISOString(),
      toursCount: 0,
      tourDetailsCount: 0,
      warnings: [],
      errors: ["PAYLOAD_SECRET is not set"],
      jobsRun: ["icc", "wtc", "rankings"],
    };
  }

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

  return {
    ok: errors.length === 0,
    fetchedAt: new Date().toISOString(),
    toursCount: 0,
    tourDetailsCount: 0,
    warnings,
    errors,
    jobsRun: ["icc", "wtc", "rankings"],
  };
}

/**
 * Refresh squads for active tours with upcoming match types.
 */
export async function syncSquads(options?: SyncCricketOptions): Promise<SyncCricketResult> {
  if (!isPayloadConfigured()) {
    return {
      ok: false,
      fetchedAt: new Date().toISOString(),
      toursCount: 0,
      tourDetailsCount: 0,
      warnings: [],
      errors: ["PAYLOAD_SECRET is not set"],
      jobsRun: [],
    };
  }

  const result = await refreshSquadsForActiveTours();

  return {
    ok: result.ok,
    fetchedAt: new Date().toISOString(),
    toursCount: 0,
    tourDetailsCount: result.toursProcessed,
    warnings: result.warnings,
    errors: result.errors,
    jobsRun: [],
  };
}

/**
 * Sync Bangladesh last completed match and upcoming matches.
 */
export async function syncBangladeshLive(options?: SyncCricketOptions): Promise<SyncCricketResult> {
  const warnings: string[] = [];
  const errors: string[] = [];

  if (!isPayloadConfigured()) {
    return {
      ok: false,
      fetchedAt: new Date().toISOString(),
      toursCount: 0,
      tourDetailsCount: 0,
      warnings: [],
      errors: ["PAYLOAD_SECRET is not set"],
      jobsRun: ["last-match", "upcoming"],
    };
  }

  try {
    const lastMatch = await scrapeBangladeshLastMatch();
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
    const upcoming = await scrapeBangladeshUpcomingMatches();
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

  return {
    ok: errors.length === 0,
    fetchedAt: new Date().toISOString(),
    toursCount: 0,
    tourDetailsCount: 0,
    warnings,
    errors,
    jobsRun: ["last-match", "upcoming"],
  };
}

/**
 * Sync tours index from CricAPI, build per-tour detail snapshots.
 */
export async function syncToursIndex(options?: SyncCricketOptions): Promise<SyncCricketResult> {
  const warnings: string[] = [];
  const errors: string[] = [];
  let toursCount = 0;
  let tourDetailsCount = 0;

  if (!isPayloadConfigured()) {
    return {
      ok: false,
      fetchedAt: new Date().toISOString(),
      toursCount: 0,
      tourDetailsCount: 0,
      warnings: [],
      errors: ["PAYLOAD_SECRET is not set"],
      jobsRun: ["tours"],
    };
  }

  if (!hasPersistedDatabase()) {
    return {
      ok: false,
      fetchedAt: new Date().toISOString(),
      toursCount: 0,
      tourDetailsCount: 0,
      warnings: [],
      errors: ["No database configured"],
      jobsRun: ["tours"],
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
      errors: [`Database schema: ${e instanceof Error ? e.message : "error"}`],
      jobsRun: ["tours"],
    };
  }

  const keysToKeep = new Set<string>([
    CRICKET_SNAPSHOT_KEYS.rankingsShowcase,
    CRICKET_SNAPSHOT_KEYS.toursIndex,
    CRICKET_SNAPSHOT_KEYS.lastMatch,
    CRICKET_SNAPSHOT_KEYS.upcomingMatches,
  ]);

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

  if (!skipCricApi && isCricApiConfigured()) {
    beginCricApiSyncSession();
  }

  let prefetchedMatches: LiveMatchSummary[] = [];

  if (!skipCricApi && isCricApiConfigured()) {
    try {
      prefetchedMatches = await prefetchMatchesForSync();
    } catch (e) {
      const message = e instanceof Error ? e.message : "CricAPI prefetch failed";
      warnings.push(message);
    }
    warnings.push(...getCricApiKeyWarnings());
  }

  try {
    const toursIndex = await buildToursIndexLive({ prefetchedMatches });
    warnings.push(...toursIndex.warnings);

    const cricApiBlocked = isCricApiBlocked() || isCricApiRateLimited(toursIndex.warnings);
    const keepPrevious = shouldKeepPreviousToursSnapshot(previousTours, toursIndex, cricApiBlocked);

    let toursToProcess = toursIndex;
    let squadsOnly = false;

    if (keepPrevious && previousTours) {
      toursToProcess = previousTours;
      squadsOnly = true;
      toursCount = previousTours.tours.length;
      warnings.push(
        `CricAPI quota/rate-limited — kept ${previousTours.tours.length} tour(s) from the last full sync (${previousToursAgeHours.toFixed(1)}h ago).`,
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
          errors.push("Tours index: CricAPI blocked and ESPNcricinfo returned no tours.");
        }
      }
    } else {
      await upsertCricketSnapshot(CRICKET_SNAPSHOT_KEYS.toursIndex, "Upcoming tours index", toursIndex);
      toursCount = toursIndex.tours.length;
    }

    if (!skipCricApi) {
      try {
        await initializeTourSyncState(toursToProcess);
        console.log("[cricket] Initialized tour_sync_state for new tours");
      } catch (e) {
        warnings.push(`tour_sync_state init: ${e instanceof Error ? e.message : "failed"}`);
      }
    }

    if (toursCount > 0) {
      try {
        await markFinishedTours(toursToProcess);
      } catch (e) {
        warnings.push(`marking finished tours: ${e instanceof Error ? e.message : "failed"}`);
      }
    }

    const detailResult = await syncTourDetails(toursToProcess.tours, toursToProcess.warnings, keysToKeep, {
      squadsOnly,
    });
    tourDetailsCount = detailResult.built;
    errors.push(...detailResult.errors);

    if (toursCount > 0) {
      const prunedDb = await deleteCricketSnapshotsExcept(keysToKeep);
      const slugsToKeep = new Set(
        [...keysToKeep]
          .map((key) => (key.startsWith("tour-detail:") ? key.slice("tour-detail:".length) : null))
          .filter((slug): slug is string => Boolean(slug)),
      );
      const prunedJson = await pruneTourDetailSnapshots(slugsToKeep);
      const pruned = prunedDb + prunedJson;
      if (pruned > 0) {
        warnings.push(`Removed ${pruned} outdated tour snapshot(s).`);
      }
    }
  } catch (e) {
    errors.push(`Tours index: ${e instanceof Error ? e.message : "failed"}`);
  }

  return {
    ok: errors.length === 0,
    fetchedAt: new Date().toISOString(),
    toursCount,
    tourDetailsCount,
    warnings: [...new Set(warnings)],
    errors,
    jobsRun: ["tours"],
  };
}

/**
 * Coordinator: dispatch to individual modular jobs based on selection.
 * Aggregates results from all jobs run.
 */
export async function syncCricketSnapshots(options?: SyncCricketOptions): Promise<SyncCricketResult> {
  const jobsRun = resolveCricketSyncJobs(options?.jobs);
  const run = (job: CricketSyncJobId) => jobsRun.includes(job);

  const results: SyncCricketResult[] = [];

  if (!isPayloadConfigured() || !hasPersistedDatabase()) {
    return {
      ok: false,
      fetchedAt: new Date().toISOString(),
      toursCount: 0,
      tourDetailsCount: 0,
      warnings: [],
      errors: ["PAYLOAD_SECRET or database not configured"],
      jobsRun,
    };
  }

  try {
    await ensureSqliteCricketSnapshotsTable();

    if (run("players")) {
      await ensureCountriesSeeded();
      const repairedPlayers = await repairInvalidPlayerProfiles();
      if (repairedPlayers > 0) {
        console.log(`[cricket] Cleared ${repairedPlayers} invalid player profile URLs`);
      }
    }
  } catch (e) {
    return {
      ok: false,
      fetchedAt: new Date().toISOString(),
      toursCount: 0,
      tourDetailsCount: 0,
      warnings: [],
      errors: [`Database schema: ${e instanceof Error ? e.message : "error"}`],
      jobsRun,
    };
  }

  if (run("icc") || run("wtc") || run("rankings")) {
    results.push(await syncRankings(options));
  }

  if (run("last-match") || run("upcoming")) {
    results.push(await syncBangladeshLive(options));
  }

  if (run("tours")) {
    results.push(await syncToursIndex(options));
  }

  const aggregated: SyncCricketResult = {
    ok: results.every((r) => r.ok),
    fetchedAt: new Date().toISOString(),
    toursCount: results.reduce((sum, r) => sum + r.toursCount, 0),
    tourDetailsCount: results.reduce((sum, r) => sum + r.tourDetailsCount, 0),
    warnings: [...new Set(results.flatMap((r) => r.warnings))],
    errors: results.flatMap((r) => r.errors),
    jobsRun,
  };

  return aggregated;
}

/** Log summary for CLI / cron. */
export function logSyncResult(result: SyncCricketResult): void {
  console.log(`Cricket sync finished at ${result.fetchedAt}`);
  console.log(`  Jobs: ${result.jobsRun.join(", ")}`);
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
