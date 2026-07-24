import {
  buildMatchesFromCuratedFixtures,
  buildMatchesFromEspnEvents,
  enrichMatchFixtureTimes,
  espnLeaguesForTour,
} from "@/lib/cricket/providers/espn-fixtures";
import { buildTourMatchesFromEspnSeries } from "@/lib/cricket/providers/espn-live";
import { applyEspnTourSquads, refreshEspnTourSquads } from "@/lib/cricket/providers/espn-squads";
import { tourToCard } from "@/lib/cricket/services/tours-display";
import type { TourDetailSnapshot } from "@/lib/cricket/snapshot-types";
import type { TourDetail } from "@/lib/cricket/tour-detail-types";
import {
  applyFormatCountsFromMatches,
  countTourFormatsFromMatches,
  filterMatchesForTour,
} from "@/lib/cricket/tour-identity";
import type { LiveMatchSummary, Tour } from "@/lib/cricket/types";
import { mergeMatchLists, sortMatchesByDate } from "@/lib/cricket/match-sort";
import { resolveTourVenues } from "@/lib/cricket/venues";
import { tourSlug } from "@/lib/cricket/tour-slug";

/**
 * CricAPI is only used to discover that a tour exists (the FTP) and for live scores —
 * it is deliberately not used here. ESPNcricinfo is the source of truth for series,
 * match, and squad details once a tour is known; CricAPI's own series records don't
 * reliably line up with ESPNcricinfo's ids, so mixing the two in has produced wrong or
 * incomplete data. Use the admin "ESPN series source per tour" override when
 * auto-discovery matches the wrong (or no) ESPNcricinfo series.
 */
async function fetchFixturesFromEspn(tour: Tour, slug: string): Promise<LiveMatchSummary[]> {
  const leagues = await espnLeaguesForTour(tour);
  console.log(`[cricket] ${slug}: espnLeaguesForTour → ${leagues.length} league(s) [${leagues.map((l) => `cricinfo=${l.cricinfoSeriesId}/espn=${l.espnLeagueId}`).join(", ")}]`);

  const batches: LiveMatchSummary[][] = [];

  for (const league of leagues) {
    const espnMatches = await buildTourMatchesFromEspnSeries(tour, league);
    console.log(`[cricket] ${slug}: league cricinfo=${league.cricinfoSeriesId} → ${espnMatches.length} match(es) via ESPN series events`);
    if (espnMatches.length) batches.push(espnMatches);
  }

  if (batches.length) {
    return mergeMatchLists(...batches);
  }

  const curated = await buildMatchesFromCuratedFixtures(tour);
  if (curated.length) {
    console.log(`[cricket] ${slug}: ${curated.length} match(es) via curated fixture times (data/espn-fixture-times.json)`);
    return curated;
  }

  const eventMatches = await buildMatchesFromEspnEvents(tour);
  console.log(`[cricket] ${slug}: ${eventMatches.length} match(es) via ESPN core events fallback`);
  return eventMatches;
}

async function resolveTourFixtures(
  tour: Tour,
  slug: string,
  warnings: string[],
): Promise<LiveMatchSummary[]> {
  const espnMatches = await fetchFixturesFromEspn(tour, slug);
  const counts = countTourFormatsFromMatches(espnMatches);
  console.log(
    `[cricket] ${slug}: fixtures resolved — test=${counts.test} odi=${counts.odi} t20=${counts.t20} (${espnMatches.length} total)`,
  );

  if (espnMatches.length) {
    // Purely informational (source attribution, not a problem) -- log only, don't surface as
    // an admin-facing warning.
  } else {
    warnings.push(
      "ESPNcricinfo has no fixtures for this series yet — check the series is matched correctly in the admin panel.",
    );
  }

  return espnMatches;
}

/** Live build — only used by the nightly sync job. */
export async function buildTourDetailLive(
  tour: Tour,
  tourWarnings: string[] = [],
): Promise<TourDetail> {
  const slug = tourSlug(tour);
  const warnings = [...tourWarnings];
  const matches = await resolveTourFixtures(tour, slug, warnings);

  const { squads, warnings: squadWarnings } = await refreshEspnTourSquads(tour);
  const squadSummary = squads.map((s) => `${s.team} (${s.players.length})`).join(", ") || "none";
  console.log(
    `[cricket] ${slug}: squads resolved — ${squads.length} squad(s): ${squadSummary}` +
      (squadWarnings.length ? ` | ${squadWarnings.join(" / ")}` : ""),
  );
  warnings.push(...squadWarnings);

  const timedMatches = await enrichMatchFixtureTimes(matches, { tour });
  const sortedMatches = sortMatchesByDate(filterMatchesForTour(tour, timedMatches));
  const tourWithCounts = applyFormatCountsFromMatches(tour, sortedMatches);
  const venues = await resolveTourVenues(sortedMatches, { persist: true });
  console.log(
    `[cricket] ${slug}: after tour-window filtering — ${sortedMatches.length} match(es) kept, ${venues.length} venue guide(s)`,
  );

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
