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
import { matchBelongsToTour, isUmbrellaTourName, filterMatchesForTour } from "@/lib/cricket/tour-identity";
import type { LiveMatchSummary, Tour } from "@/lib/cricket/types";
import { sortMatchesByDate } from "@/lib/cricket/match-sort";
import { resolveTourVenues } from "@/lib/cricket/venues";

async function fallbackMatches(tour: Tour): Promise<LiveMatchSummary[]> {
  if (!isCricApiConfigured() || isCricApiBlocked()) return [];

  const all = await fetchMatchesList(6).catch(() => []);
  const filtered = all.filter((m) => matchBelongsToTour(m, tour));

  return sortMatchesByDate(filtered);
}

async function espnFallbackMatches(tour: Tour, warnings: string[]): Promise<LiveMatchSummary[]> {
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
    warnings.push("Fixture list from confirmed ESPN schedule (CricAPI unavailable).");
    return matches;
  }

  matches = await buildMatchesFromEspnEvents(tour);
  if (matches.length) {
    warnings.push("Fixture list from live ESPNcricinfo schedule (CricAPI unavailable).");
  }

  return matches;
}

/** Live build — only used by the nightly sync job. */
export async function buildTourDetailLive(
  tour: Tour,
  tourWarnings: string[] = [],
): Promise<TourDetail> {
  const warnings = [...tourWarnings];
  let matches: LiveMatchSummary[] = [];
  const useCricApi = isCricApiConfigured() && !isCricApiBlocked();

  if (isUmbrellaTourName(tour.name)) {
    matches = await espnFallbackMatches(tour, warnings);
  }

  if (useCricApi && !matches.length) {
    if (isUmbrellaTourName(tour.name)) {
      matches = await fallbackMatches(tour);
    }

    if (!matches.length) {
      const info = await fetchSeriesInfo(tour.id).catch(() => ({ matches: [], squads: [] }));
      matches = info.matches.filter((m) => matchBelongsToTour(m, tour));
    }

    if (!matches.length) {
      matches = await fallbackMatches(tour);
      if (matches.length) {
        warnings.push(
          "Match list matched by name — full series schedule may update when CricAPI syncs.",
        );
      }
    }

    if (!matches.length) {
      matches = await espnFallbackMatches(tour, warnings);
    }
  } else if (!matches.length) {
    if (isCricApiBlocked()) {
      warnings.push("CricAPI quota/rate-limited — fixtures and squads from ESPNcricinfo.");
    } else {
      warnings.push("CricAPI not configured — fixtures and squads from ESPNcricinfo.");
    }
    matches = await espnFallbackMatches(tour, warnings);
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
