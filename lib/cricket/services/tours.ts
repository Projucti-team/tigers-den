import { isBangladeshTeam } from "@/lib/cricket/constants";
import {
  fetchUpcomingTours,
  isCricApiBlocked,
  isCricApiConfigured,
} from "@/lib/cricket/providers/cricapi";
import { fetchEspnFutureTours } from "@/lib/cricket/providers/espn-fixtures";
import { CRICKET_SNAPSHOT_KEYS } from "@/lib/cricket/snapshot-keys";
import { readCricketSnapshot, staleSnapshotWarning } from "@/lib/cricket/snapshot-db";
import { isFutureSeries } from "@/lib/cricket/tour-dates";
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

function normalizeTourName(name: string): string {
  return name
    .toLowerCase()
    .replace(/,?\s*\d{4}(-\d{2})?$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Add confirmed ESPN schedules missing from the nightly CricAPI snapshot. */
async function mergeCuratedTours(tours: Tour[]): Promise<Tour[]> {
  const { tours: curated } = await fetchEspnFutureTours();
  if (!curated.length) return tours;

  const seenIds = new Set(tours.map((t) => t.id));
  const seenNames = new Set(tours.map((t) => normalizeTourName(t.name)));
  const merged = [...tours];

  for (const tour of curated) {
    if (!isFutureSeries(tour.startDate, tour.endDate)) continue;
    const nameKey = normalizeTourName(tour.name);
    if (seenIds.has(tour.id) || seenNames.has(nameKey)) continue;
    seenIds.add(tour.id);
    seenNames.add(nameKey);
    merged.push(tour);
  }

  return merged.sort((a, b) => {
    const da = a.startDate ? new Date(a.startDate).getTime() : 0;
    const db = b.startDate ? new Date(b.startDate).getTime() : 0;
    return da - db;
  });
}

/** Live CricAPI fetch — nightly sync only. Falls back to ESPNcricinfo when CricAPI is blocked. */
export async function buildFutureToursLive(options?: {
  bangladeshOnly?: boolean;
  prefetchedMatches?: LiveMatchSummary[];
}): Promise<{
  tours: Tour[];
  warnings: string[];
}> {
  const warnings: string[] = [];
  let tours: Tour[] = [];

  if (isCricApiConfigured() && !isCricApiBlocked()) {
    try {
      const { tours: fetched, warnings: fetchWarnings } = await fetchUpcomingTours({
        prefetchedMatches: options?.prefetchedMatches,
      });
      tours = fetched;
      warnings.push(...fetchWarnings);
    } catch (e) {
      warnings.push(e instanceof Error ? e.message : "Failed to fetch tours.");
    }
  } else if (isCricApiBlocked()) {
    warnings.push("CricAPI quota/rate-limited — using ESPNcricinfo for tours.");
    const espn = await fetchEspnFutureTours();
    tours = espn.tours;
    warnings.push(...espn.warnings);
  } else {
    warnings.push("CricAPI not configured — using ESPNcricinfo for tours.");
    const espn = await fetchEspnFutureTours();
    tours = espn.tours;
    warnings.push(...espn.warnings);
  }

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
