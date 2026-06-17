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
} from "@/lib/cricket/providers/espn-fixtures";
import { refreshEspnTourSquads, applyEspnTourSquads } from "@/lib/cricket/providers/espn-squads";
import { tourToCard } from "@/lib/cricket/services/tours-display";
import type { TourDetailSnapshot } from "@/lib/cricket/snapshot-types";
import type { TourDetail } from "@/lib/cricket/tour-detail-types";
import type { LiveMatchSummary, Tour } from "@/lib/cricket/types";
import { sortMatchesByDate } from "@/lib/cricket/match-sort";
import { uniqueVenuesFromMatches } from "@/lib/cricket/venues";

function tourKeywords(name: string): string[] {
  const cleaned = name
    .replace(/,?\s*\d{4}(-\d{2})?$/i, "")
    .replace(/bangladesh tour of/i, "")
    .replace(/tour of bangladesh/i, "")
    .trim()
    .toLowerCase();

  const parts = cleaned.split(/\s+/).filter((w) => w.length > 2 && w !== "tour" && w !== "of");
  return parts.length ? parts : [cleaned];
}

function matchBelongsToTour(match: LiveMatchSummary, tour: Tour): boolean {
  const blob = `${match.name} ${match.teams?.join(" ") ?? ""}`.toLowerCase();
  const keys = tourKeywords(tour.name);
  const hits = keys.filter((k) => blob.includes(k));
  return hits.length >= Math.min(2, keys.length) || blob.includes("bangladesh");
}

async function fallbackMatches(tour: Tour): Promise<LiveMatchSummary[]> {
  if (!isCricApiConfigured() || isCricApiBlocked()) return [];

  const all = await fetchMatchesList(6).catch(() => []);
  const filtered = all.filter((m) => matchBelongsToTour(m, tour));

  return sortMatchesByDate(filtered);
}

async function espnFallbackMatches(tour: Tour, warnings: string[]): Promise<LiveMatchSummary[]> {
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

  if (useCricApi) {
    const info = await fetchSeriesInfo(tour.id).catch(() => ({ matches: [], squads: [] }));
    matches = info.matches;

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
  } else {
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
  const sortedMatches = sortMatchesByDate(timedMatches);
  const venues = uniqueVenuesFromMatches(sortedMatches);

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
