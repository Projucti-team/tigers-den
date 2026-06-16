import {
  buildMatchesFromCuratedFixtures,
  enrichMatchFixtureTimes,
} from "@/lib/cricket/providers/espn-fixtures";
import {
  applyEspnTourSquads,
  loadEspnTourSquadsFromCache,
} from "@/lib/cricket/providers/espn-squads";
import { enrichSquadPlayersForDisplay } from "@/lib/cricket/players/registry";
import { mergeSquads, squadPrimaryNation } from "@/lib/cricket/squads/types";
import { CRICKET_SNAPSHOT_KEYS } from "@/lib/cricket/snapshot-keys";
import { readCricketSnapshot, staleSnapshotWarning } from "@/lib/cricket/snapshot-db";
import { getFutureTours } from "@/lib/cricket/services/tours";
import { tourToCard } from "@/lib/cricket/services/tours-display";
import type { TourDetailSnapshot } from "@/lib/cricket/snapshot-types";
import { findTourBySlug } from "@/lib/cricket/tour-slug";
import { uniqueVenuesFromMatches } from "@/lib/cricket/venues";
import { sortMatchesByDate } from "@/lib/cricket/match-sort";

export type { TourDetail } from "@/lib/cricket/tour-detail-types";

async function buildCuratedTourDetail(slug: string): Promise<TourDetailSnapshot | null> {
  const { tours } = await getFutureTours({ bangladeshOnly: true });
  const tour = findTourBySlug(tours, slug);
  if (!tour) return null;

  const matches = sortMatchesByDate(
    await enrichMatchFixtureTimes(
      await buildMatchesFromCuratedFixtures(tour),
      { tour },
    ),
  );
  if (!matches.length) return null;

  const espnSquads = await loadEspnTourSquadsFromCache(tour);
  const mergedSquads = mergeSquads([], espnSquads);
  const squads = await Promise.all(
    mergedSquads.map(async (squad) => ({
      ...squad,
      players: await enrichSquadPlayersForDisplay(squadPrimaryNation(squad.team), squad.players),
    })),
  );
  const warnings = ["Fixture list from confirmed ESPN schedule (full sync pending)."];

  const detail = applyEspnTourSquads(
    {
      tour,
      card: tourToCard(tour, 0),
      matches,
      squads,
      venues: uniqueVenuesFromMatches(matches),
      warnings,
    },
    squads,
  );

  return {
    ...detail,
    slug,
    fetchedAt: new Date().toISOString(),
  };
}

/** Read pre-built tour page from DB (nightly cron). */
export async function getTourDetail(slug: string): Promise<TourDetailSnapshot | null> {
  const cached = await readCricketSnapshot<TourDetailSnapshot>(
    CRICKET_SNAPSHOT_KEYS.tourDetail(slug),
  );
  if (!cached) {
    return buildCuratedTourDetail(slug);
  }

  const espnSquads = await loadEspnTourSquadsFromCache(cached.tour);
  const mergedSquads = mergeSquads(cached.squads, espnSquads);
  const squads = await Promise.all(
    mergedSquads.map(async (squad) => ({
      ...squad,
      players: await enrichSquadPlayersForDisplay(squadPrimaryNation(squad.team), squad.players),
    })),
  );
  const withSquads = applyEspnTourSquads(cached, squads);
  const matches = sortMatchesByDate(
    await enrichMatchFixtureTimes(withSquads.matches, { tour: cached.tour }),
  );
  const enriched = { ...withSquads, matches };
  const warnings = [...enriched.warnings];
  const stale = staleSnapshotWarning(cached.fetchedAt, "Tour");
  if (stale) warnings.push(stale);

  return { ...enriched, warnings };
}
