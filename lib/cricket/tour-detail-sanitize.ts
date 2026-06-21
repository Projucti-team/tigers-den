import type { TourDetailSnapshot } from "@/lib/cricket/snapshot-types";
import { filterMatchesForTour } from "@/lib/cricket/tour-identity";
import type { Tour } from "@/lib/cricket/types";

/** Strip fixtures, venues, and squads copied from the wrong bilateral tour in job snapshots. */
export function sanitizeTourSnapshotForRead(
  tour: Tour,
  cached: TourDetailSnapshot,
): Pick<TourDetailSnapshot, "matches" | "venues" | "squads"> {
  const matches = filterMatchesForTour(tour, cached.matches);
  const snapshotMismatch = matches.length !== cached.matches.length;

  if (snapshotMismatch) {
    return { matches, venues: [], squads: cached.squads };
  }

  if (matches.length === 0) {
    return { matches, venues: [], squads: cached.squads };
  }

  return {
    matches,
    venues: cached.venues,
    squads: cached.squads,
  };
}
