import { enrichIccSnapshotPlayerImages } from "@/lib/cricket/player-images";
import { fetchAllIccRankingsFromSportz } from "@/lib/cricket/providers/icc-sportz";
import type { IccRankingsSnapshot } from "@/lib/cricket/providers/icc-sportz";
import { fetchWtcStandingsFromEspn } from "@/lib/cricket/providers/wtc-espn";
import { writeIccRankingsSnapshot } from "@/lib/cricket/icc-rankings-store";
import { writeWtcStandingsSnapshot } from "@/lib/cricket/wtc-store";
import { buildRankingsShowcaseLive } from "@/lib/cricket/services/build-rankings-showcase";
import { buildTourDetailLive, toTourDetailSnapshot } from "@/lib/cricket/services/build-tour-detail";
import { buildToursIndexLive } from "@/lib/cricket/services/build-tours-index";
import { scrapeBangladeshLastMatch } from "@/lib/cricket/services/bangladesh-last-match";
import { scrapeBangladeshUpcomingMatches } from "@/lib/cricket/services/bangladesh-upcoming-matches";
import { CRICKET_SNAPSHOT_KEYS } from "@/lib/cricket/snapshot-keys";
import {
  deleteCricketSnapshotsExcept,
  upsertCricketSnapshot,
} from "@/lib/cricket/snapshot-db";
import { tourSlug } from "@/lib/cricket/tour-slug";
import type { WtcStandingsSnapshot } from "@/lib/cricket/types";
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

  if (!process.env.POSTGRES_URL && !process.env.DATABASE_URL) {
    return {
      ok: false,
      fetchedAt: new Date().toISOString(),
      toursCount: 0,
      tourDetailsCount: 0,
      warnings: [],
      errors: [
        "POSTGRES_URL is not set — connect Neon Postgres in Vercel Storage and redeploy.",
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
    const toursIndex = await buildToursIndexLive();
    await upsertCricketSnapshot(CRICKET_SNAPSHOT_KEYS.toursIndex, "Upcoming tours index", toursIndex);
    warnings.push(...toursIndex.warnings);
    toursCount = toursIndex.tours.length;

    for (const tour of toursIndex.tours) {
      const slug = tourSlug(tour);
      const key = CRICKET_SNAPSHOT_KEYS.tourDetail(slug);
      keysToKeep.add(key);

      try {
        const detail = await buildTourDetailLive(tour, toursIndex.warnings);
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
