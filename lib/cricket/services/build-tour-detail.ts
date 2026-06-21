import {
  fetchSeriesInfo,
  isCricApiBlocked,
  isCricApiConfigured,
} from "@/lib/cricket/providers/cricapi";
import {
  buildMatchesFromCuratedFixtures,
  buildMatchesFromEspnEvents,
  enrichMatchFixtureTimes,
  espnLeaguesForTour,
} from "@/lib/cricket/providers/espn-fixtures";
import { buildTourMatchesFromEspnSeries } from "@/lib/cricket/providers/espn-live";
import { resolveAllEspnLeaguesForTour } from "@/lib/cricket/providers/espn-squads";
import { refreshEspnTourSquads, applyEspnTourSquads } from "@/lib/cricket/providers/espn-squads";
import { mergeTourFixtures } from "@/lib/cricket/services/merge-tour-fixtures";
import { tourToCard } from "@/lib/cricket/services/tours-display";
import type { TourDetailSnapshot } from "@/lib/cricket/snapshot-types";
import type { TourDetail } from "@/lib/cricket/tour-detail-types";
import {
  applyFormatCountsFromMatches,
  espnFixturesLookComplete,
  filterMatchesForTour,
  matchBelongsToTour,
} from "@/lib/cricket/tour-identity";
import type { LiveMatchSummary, Tour } from "@/lib/cricket/types";
import { mergeMatchLists, sortMatchesByDate } from "@/lib/cricket/match-sort";
import { resolveTourVenues } from "@/lib/cricket/venues";

async function fetchFixturesFromEspn(tour: Tour): Promise<LiveMatchSummary[]> {
  const leagues = await espnLeaguesForTour(tour);
  const batches: LiveMatchSummary[][] = [];

  for (const league of leagues) {
    const espnMatches = await buildTourMatchesFromEspnSeries(tour, league);
    if (espnMatches.length) batches.push(espnMatches);
  }

  if (batches.length) {
    return mergeMatchLists(...batches);
  }

  const curated = await buildMatchesFromCuratedFixtures(tour);
  if (curated.length) return curated;

  return buildMatchesFromEspnEvents(tour);
}

async function fetchFixturesFromCricApi(tour: Tour, warnings: string[]): Promise<LiveMatchSummary[]> {
  if (!isCricApiConfigured() || isCricApiBlocked()) return [];

  const seriesIds = new Set<string>();
  if (/^\d+$/.test(tour.id)) seriesIds.add(tour.id);

  const leagues = await resolveAllEspnLeaguesForTour(tour.name, tour.id, tour.startDate);
  for (const league of leagues) {
    seriesIds.add(String(league.cricinfoSeriesId));
  }

  const matches: LiveMatchSummary[] = [];
  const seen = new Set<string>();

  for (const seriesId of seriesIds) {
    const info = await fetchSeriesInfo(seriesId).catch(() => ({ matches: [], squads: [] }));
    for (const match of info.matches.filter((m) => matchBelongsToTour(m, tour))) {
      const key = match.id || `${match.date}|${match.name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      matches.push(match);
    }
  }

  if (matches.length) {
    warnings.push("Fixtures from CricAPI series schedule.");
  }

  return sortMatchesByDate(matches);
}

async function resolveTourFixtures(
  tour: Tour,
  warnings: string[],
): Promise<LiveMatchSummary[]> {
  const espnMatches = await fetchFixturesFromEspn(tour);

  if (espnFixturesLookComplete(tour, espnMatches)) {
    if (espnMatches.length) {
      warnings.push("Fixtures and results from ESPNcricinfo.");
    }
    return espnMatches;
  }

  const cricapiMatches = await fetchFixturesFromCricApi(tour, warnings);

  if (cricapiMatches.length > espnMatches.length) {
    warnings.push("Fixtures from CricAPI (ESPNcricinfo schedule incomplete).");
    return mergeTourFixtures(espnMatches, cricapiMatches);
  }

  if (espnMatches.length) {
    warnings.push("Fixtures and results from ESPNcricinfo.");
    return espnMatches;
  }

  if (cricapiMatches.length) {
    warnings.push("Fixtures from CricAPI (ESPNcricinfo had no schedule for this tour).");
    return cricapiMatches;
  }

  if (isCricApiBlocked()) {
    warnings.push("CricAPI quota/rate-limited — no fixture fallback available.");
  } else if (!isCricApiConfigured()) {
    warnings.push("CricAPI not configured — no fixture fallback available.");
  }

  return [];
}

/** Live build — only used by the nightly sync job. */
export async function buildTourDetailLive(
  tour: Tour,
  tourWarnings: string[] = [],
): Promise<TourDetail> {
  const warnings = [...tourWarnings];
  const matches = await resolveTourFixtures(tour, warnings);

  const { squads, warnings: squadWarnings } = await refreshEspnTourSquads(tour);
  warnings.push(...squadWarnings);

  const timedMatches = await enrichMatchFixtureTimes(matches, { tour });
  const sortedMatches = sortMatchesByDate(filterMatchesForTour(tour, timedMatches));
  const tourWithCounts = applyFormatCountsFromMatches(tour, sortedMatches);
  const venues = await resolveTourVenues(sortedMatches, { persist: true });

  return applyEspnTourSquads(
    {
      tour: tourWithCounts,
      card: tourToCard(tourWithCounts, 0),
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
