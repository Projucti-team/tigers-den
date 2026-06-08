import {
  fetchMatchesList,
  fetchSeriesInfo,
  fetchSeriesSquads,
  isCricApiConfigured,
} from "@/lib/cricket/providers/cricapi";
import {
  applyCuratedTourSquads,
  type SeriesSquad,
} from "@/lib/cricket/curated-squads";
import { tourToCard } from "@/lib/cricket/services/tours-display";
import type { TourDetailSnapshot } from "@/lib/cricket/snapshot-types";
import { tourSlug } from "@/lib/cricket/tour-slug";
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
  if (!isCricApiConfigured()) return [];

  const all = await fetchMatchesList(6).catch(() => []);
  const filtered = all.filter((m) => matchBelongsToTour(m, tour));

  return sortMatchesByDate(filtered);
}

/** Live build — only used by the nightly sync job. */
export async function buildTourDetailLive(
  tour: Tour,
  tourWarnings: string[] = [],
): Promise<TourDetail> {
  const warnings = [...tourWarnings];
  let matches: LiveMatchSummary[] = [];
  let squads: SeriesSquad[] = [];

  if (isCricApiConfigured()) {
    const info = await fetchSeriesInfo(tour.id).catch(() => ({ matches: [], squads: [] }));
    matches = info.matches;
    squads = info.squads;

    if (!squads.length) {
      squads = await fetchSeriesSquads(tour.id).catch(() => []);
    }

    if (!matches.length) {
      matches = await fallbackMatches(tour);
      if (matches.length) {
        warnings.push(
          "Match list matched by name — full series schedule may update when CricAPI syncs.",
        );
      }
    }

  } else {
    warnings.push("Live tour data unavailable — set CRICKET_DATA_API_KEY for fixtures and squads.");
    matches = await fallbackMatches(tour);
  }

  const sortedMatches = sortMatchesByDate(matches);
  const venues = uniqueVenuesFromMatches(sortedMatches);

  return applyCuratedTourSquads({
    tour,
    card: tourToCard(tour, 0),
    matches: sortedMatches,
    squads,
    venues,
    warnings,
  });
}

export function toTourDetailSnapshot(detail: TourDetail, slug: string): TourDetailSnapshot {
  return {
    ...detail,
    slug,
    fetchedAt: new Date().toISOString(),
  };
}
