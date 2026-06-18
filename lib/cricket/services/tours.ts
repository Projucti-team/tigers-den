import { isBangladeshTeam } from "@/lib/cricket/constants";
import {
  fetchUpcomingTours,
  isCricApiConfigured,
} from "@/lib/cricket/providers/cricapi";
import { fetchEspnFutureTours } from "@/lib/cricket/providers/espn-fixtures";
import { CRICKET_SNAPSHOT_KEYS } from "@/lib/cricket/snapshot-keys";
import { readCricketSnapshot, staleSnapshotWarning } from "@/lib/cricket/snapshot-db";
import { deduplicateTours } from "@/lib/cricket/tour-identity";
import type { ToursIndexSnapshot } from "@/lib/cricket/snapshot-types";
import type { LiveMatchSummary, Tour } from "@/lib/cricket/types";

export function filterBangladeshTours(tours: Tour[]): Tour[] {
  return tours.filter((t) => {
    const name = t.name.toLowerCase();
    if (isBangladeshTeam(name)) return true;
    if (t.teams?.some((team) => isBangladeshTeam(team))) return true;
    return false;
  });
}

/** Add confirmed ESPN schedules missing from the nightly CricAPI snapshot. */
async function mergeCuratedTours(tours: Tour[]): Promise<Tour[]> {
  const { tours: curated } = await fetchEspnFutureTours();
  if (!curated.length) return deduplicateTours(tours);
  return deduplicateTours([...tours, ...curated]);
}

/** ESPNcricinfo-only — used when CricAPI is blocked and there is no fresh CricAPI snapshot. */
export async function buildFutureToursFromEspnOnly(options?: {
  bangladeshOnly?: boolean;
}): Promise<{
  tours: Tour[];
  warnings: string[];
}> {
  const warnings = ["CricAPI unavailable — using ESPNcricinfo for tours."];
  const espn = await fetchEspnFutureTours();
  warnings.push(...espn.warnings);

  let tours = deduplicateTours(espn.tours);
  if (options?.bangladeshOnly) {
    tours = filterBangladeshTours(tours);
  }

  return { tours, warnings: [...new Set(warnings)] };
}

/** Live fetch — CricAPI first, ESPN supplements missing series. */
export async function buildFutureToursLive(options?: {
  bangladeshOnly?: boolean;
  prefetchedMatches?: LiveMatchSummary[];
}): Promise<{
  tours: Tour[];
  warnings: string[];
}> {
  const warnings: string[] = [];
  let tours: Tour[] = [];

  if (!isCricApiConfigured()) {
    return buildFutureToursFromEspnOnly(options);
  }

  try {
    const { tours: fetched, warnings: fetchWarnings } = await fetchUpcomingTours({
      prefetchedMatches: options?.prefetchedMatches,
    });
    tours = fetched;
    warnings.push(...fetchWarnings);
  } catch (e) {
    warnings.push(e instanceof Error ? e.message : "Failed to fetch tours from CricAPI.");
  }

  tours = deduplicateTours(tours);

  if (options?.bangladeshOnly) {
    const before = tours.length;
    tours = filterBangladeshTours(tours);
    if (before > 0 && tours.length === 0) {
      warnings.push(
        `Found ${before} future series, but none involve Bangladesh after filtering.`,
      );
    }
  }

  return { tours, warnings: [...new Set(warnings)] };
}

/** Read pre-built tours from DB (nightly cron). */
export async function getFutureTours(options?: { bangladeshOnly?: boolean }): Promise<{
  tours: Tour[];
  warnings: string[];
}> {
  const cached = await readCricketSnapshot<ToursIndexSnapshot>(CRICKET_SNAPSHOT_KEYS.toursIndex);
  const warnings: string[] = cached ? [...cached.warnings] : [];

  if (!cached) {
    warnings.push(
      "Tour data not loaded yet. Run `npm run sync:cricket` or wait for the nightly refresh (~3:00 AM BDT).",
    );
  } else {
    const stale = staleSnapshotWarning(cached.fetchedAt, "Tours");
    if (stale) warnings.push(stale);
  }

  let tours = cached?.tours ?? [];
  if (options?.bangladeshOnly) {
    tours = filterBangladeshTours(tours);
  }

  tours = await mergeCuratedTours(tours);
  if (options?.bangladeshOnly) {
    tours = filterBangladeshTours(tours);
  }

  return { tours, warnings };
}

export async function getToursIndexSnapshot(): Promise<ToursIndexSnapshot | null> {
  return readCricketSnapshot<ToursIndexSnapshot>(CRICKET_SNAPSHOT_KEYS.toursIndex);
}
