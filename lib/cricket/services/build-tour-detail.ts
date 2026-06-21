import {
  fetchMatchesList,
  fetchSeriesInfo,
  isCricApiBlocked,
  isCricApiConfigured,
} from "@/lib/cricket/providers/cricapi";
import {
  buildMatchesFromCuratedFixtures,
  buildMatchesFromEspnEvents,
  enrichMatchFixtureTimes,
  espnLeagueForTour,
} from "@/lib/cricket/providers/espn-fixtures";
import { buildTourMatchesFromEspnSeries } from "@/lib/cricket/providers/espn-live";
import { refreshEspnTourSquads, applyEspnTourSquads } from "@/lib/cricket/providers/espn-squads";
import { tourToCard } from "@/lib/cricket/services/tours-display";
import type { TourDetailSnapshot } from "@/lib/cricket/snapshot-types";
import type { TourDetail } from "@/lib/cricket/tour-detail-types";
import { matchBelongsToTour, filterMatchesForTour } from "@/lib/cricket/tour-identity";
import type { LiveMatchSummary, Tour } from "@/lib/cricket/types";
import { sortMatchesByDate } from "@/lib/cricket/match-sort";
import { resolveTourVenues } from "@/lib/cricket/venues";

async function fetchFixturesFromEspn(tour: Tour, warnings: string[]): Promise<LiveMatchSummary[]> {
  const league = await espnLeagueForTour(tour);
  if (league) {
    const espnMatches = await buildTourMatchesFromEspnSeries(tour, league);
    if (espnMatches.length) {
      warnings.push("Fixtures and results from ESPNcricinfo.");
      return espnMatches;
    }
  }

  let matches = await buildMatchesFromCuratedFixtures(tour);
  if (matches.length) {
    warnings.push("Fixture list from confirmed ESPN schedule.");
    return matches;
  }

  matches = await buildMatchesFromEspnEvents(tour);
  if (matches.length) {
    warnings.push("Fixture list from live ESPNcricinfo schedule.");
  }

  return matches;
}

async function fetchFixturesFromCricApi(tour: Tour, warnings: string[]): Promise<LiveMatchSummary[]> {
  if (!isCricApiConfigured() || isCricApiBlocked()) return [];

  const info = await fetchSeriesInfo(tour.id).catch(() => ({ matches: [], squads: [] }));
  let matches = info.matches.filter((m) => matchBelongsToTour(m, tour));

  if (!matches.length) {
    const all = await fetchMatchesList(6).catch(() => []);
    matches = all.filter((m) => matchBelongsToTour(m, tour));
    if (matches.length) {
      warnings.push(
        "Match list matched by name — full series schedule may update when CricAPI syncs.",
      );
    }
  }

  if (matches.length) {
    warnings.push("Fixtures from CricAPI (ESPNcricinfo had no schedule for this tour).");
  }

  return sortMatchesByDate(matches);
}

/** Live build — only used by the nightly sync job. */
export async function buildTourDetailLive(
  tour: Tour,
  tourWarnings: string[] = [],
): Promise<TourDetail> {
  const warnings = [...tourWarnings];

  let matches = await fetchFixturesFromEspn(tour, warnings);

  if (!matches.length) {
    matches = await fetchFixturesFromCricApi(tour, warnings);
    if (!matches.length) {
      if (isCricApiBlocked()) {
        warnings.push("CricAPI quota/rate-limited — no fixture fallback available.");
      } else if (!isCricApiConfigured()) {
        warnings.push("CricAPI not configured — no fixture fallback available.");
      }
    }
  }

  const { squads, warnings: squadWarnings } = await refreshEspnTourSquads(tour);
  warnings.push(...squadWarnings);

  const timedMatches = await enrichMatchFixtureTimes(matches, { tour });
  const sortedMatches = sortMatchesByDate(filterMatchesForTour(tour, timedMatches));
  const venues = await resolveTourVenues(sortedMatches, { persist: true });

  return applyEspnTourSquads(
    {
      tour,
      card: tourToCard(tour, 0),
      matches: sortedMatches,
      squads,
      venues,
      warnings,
    },
    squads,
  );
}

export function toTourDetailSnapshot(detail: TourDetail, slug: string): TourDetailSnapshot {
  return {
    ...detail,
    slug,
    fetchedAt: new Date().toISOString(),
  };
}
