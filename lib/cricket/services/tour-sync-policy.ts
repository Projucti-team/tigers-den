import type { ToursIndexSnapshot } from "@/lib/cricket/snapshot-types";
import { snapshotAgeHours } from "@/lib/cricket/snapshot-db";

/** Keep a recent full CricAPI tours index when a later sync hits quota. */
export const FRESH_CRICAPI_TOURS_MAX_AGE_HOURS = 24;

export function isCricApiRateLimited(warnings: string[]): boolean {
  return warnings.some((w) => /blocked|quota|rate|hits|limit|exceed|429|exhausted/i.test(w));
}

/** True when the stored index came from a successful CricAPI run within the freshness window. */
export function isFreshCricApiToursSnapshot(
  snapshot: ToursIndexSnapshot | null | undefined,
): boolean {
  if (!snapshot?.tours?.length) return false;
  if (snapshotAgeHours(snapshot.fetchedAt) >= FRESH_CRICAPI_TOURS_MAX_AGE_HOURS) return false;
  if (snapshot.toursSource === "espn") return false;
  if (snapshot.toursSource === "cricapi" || snapshot.toursSource === "mixed") return true;
  // Legacy rows before toursSource existed — CricAPI usually returns more than ESPN-only.
  return snapshot.tours.length >= 3;
}

/**
 * Prefer the previous CricAPI index when the current attempt is worse:
 * blocked, empty, or fewer tours than a fresh CricAPI snapshot.
 */
export function shouldKeepPreviousToursSnapshot(
  previous: ToursIndexSnapshot | null | undefined,
  candidate: ToursIndexSnapshot,
  cricApiBlocked: boolean,
): boolean {
  if (!isFreshCricApiToursSnapshot(previous)) return false;
  const previousCount = previous?.tours.length ?? 0;
  const candidateCount = candidate.tours.length;

  if (cricApiBlocked) return true;
  if (candidateCount === 0) return true;
  if (candidateCount < previousCount) return true;
  return false;
}

export function inferToursSource(
  warnings: string[],
  cricApiBlocked: boolean,
  tourCount: number,
): NonNullable<ToursIndexSnapshot["toursSource"]> {
  if (cricApiBlocked && tourCount <= 2) return "espn";
  if (warnings.some((w) => /using ESPNcricinfo for tours/i.test(w)) && cricApiBlocked) {
    return "espn";
  }
  if (!cricApiBlocked && tourCount > 0) {
    return warnings.some((w) => /ESPNcricinfo/i.test(w)) ? "mixed" : "cricapi";
  }
  return tourCount > 0 ? "mixed" : "espn";
}
