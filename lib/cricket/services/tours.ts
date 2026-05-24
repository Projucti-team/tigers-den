import { isBangladeshTeam } from "@/lib/cricket/constants";
import { fetchUpcomingTours, isCricApiConfigured } from "@/lib/cricket/providers/cricapi";
import { CRICKET_SNAPSHOT_KEYS } from "@/lib/cricket/snapshot-keys";
import { readCricketSnapshot, staleSnapshotWarning } from "@/lib/cricket/snapshot-db";
import type { ToursIndexSnapshot } from "@/lib/cricket/snapshot-types";
import type { Tour } from "@/lib/cricket/types";

export function filterBangladeshTours(tours: Tour[]): Tour[] {
  return tours.filter((t) => {
    const name = t.name.toLowerCase();
    if (isBangladeshTeam(name)) return true;
    if (t.teams?.some((team) => isBangladeshTeam(team))) return true;
    return false;
  });
}

/** Live CricAPI fetch — nightly sync only. */
export async function buildFutureToursLive(options?: { bangladeshOnly?: boolean }): Promise<{
  tours: Tour[];
  warnings: string[];
}> {
  const warnings: string[] = [];

  if (!isCricApiConfigured()) {
    warnings.push("CRICKET_DATA_API_KEY is not set — tour fixtures unavailable.");
    return { tours: [], warnings };
  }

  try {
    let tours = await fetchUpcomingTours();
    if (options?.bangladeshOnly) {
      tours = filterBangladeshTours(tours);
    }
    return { tours, warnings };
  } catch (e) {
    warnings.push(e instanceof Error ? e.message : "Failed to fetch tours.");
    return { tours: [], warnings };
  }
}

/** Read pre-built tours from DB (nightly cron). */
export async function getFutureTours(options?: { bangladeshOnly?: boolean }): Promise<{
  tours: Tour[];
  warnings: string[];
}> {
  const cached = await readCricketSnapshot<ToursIndexSnapshot>(CRICKET_SNAPSHOT_KEYS.toursIndex);
  if (!cached) {
    return {
      tours: [],
      warnings: [
        "Tour data not loaded yet. Run `npm run sync:cricket` or wait for the nightly refresh (~3:00 AM BDT).",
      ],
    };
  }

  const warnings = [...cached.warnings];
  const stale = staleSnapshotWarning(cached.fetchedAt, "Tours");
  if (stale) warnings.push(stale);

  let tours = cached.tours;
  if (options?.bangladeshOnly) {
    tours = filterBangladeshTours(tours);
  }

  return { tours, warnings };
}

export async function getToursIndexSnapshot(): Promise<ToursIndexSnapshot | null> {
  return readCricketSnapshot<ToursIndexSnapshot>(CRICKET_SNAPSHOT_KEYS.toursIndex);
}
