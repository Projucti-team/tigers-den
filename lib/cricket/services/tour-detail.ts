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
import { isUmbrellaTourName, matchBelongsToTour } from "@/lib/cricket/tour-identity";
import { findTourBySlug } from "@/lib/cricket/tour-slug";
import { uniqueVenuesFromMatches } from "@/lib/cricket/venues";
import { sortMatchesByDate } from "@/lib/cricket/match-sort";
import type { Tour } from "@/lib/cricket/types";

export type { TourDetail } from "@/lib/cricket/tour-detail-types";

async function matchesForUmbrellaTour(tour: Tour, cachedMatches: TourDetailSnapshot["matches"] = []) {
  const curated = await buildMatchesFromCuratedFixtures(tour);
  const source = curated.length
    ? curated
    : cachedMatches.filter((match) => matchBelongsToTour(match, tour));

  return sortMatchesByDate(await enrichMatchFixtureTimes(source, { tour }));
}

async function buildCuratedTourDetail(slug: string): Promise<TourDetailSnapshot | null> {
  const { tours } = await getFutureTours({ bangladeshOnly: true });
  const tour = findTourBySlug(tours, slug);
  if (!tour) return null;

  const matches = await matchesForUmbrellaTour(tour);
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
  const { tours } = await getFutureTours({ bangladeshOnly: true });
  const umbrella = findTourBySlug(tours, slug);

  const cached = await readCricketSnapshot<TourDetailSnapshot>(
    CRICKET_SNAPSHOT_KEYS.tourDetail(slug),
  );

  if (!umbrella && !cached) {
    return buildCuratedTourDetail(slug);
  }

  const tour = umbrella ?? cached!.tour;

  if (!cached) {
    return buildCuratedTourDetail(slug);
  }

  const espnSquads = await loadEspnTourSquadsFromCache(tour);
  const mergedSquads = mergeSquads(cached.squads, espnSquads);
  const squads = await Promise.all(
    mergedSquads.map(async (squad) => ({
      ...squad,
      players: await enrichSquadPlayersForDisplay(squadPrimaryNation(squad.team), squad.players),
    })),
  );
  const matches =
    umbrella && isUmbrellaTourName(umbrella.name)
      ? await matchesForUmbrellaTour(umbrella, cached.matches)
      : sortMatchesByDate(await enrichMatchFixtureTimes(cached.matches, { tour }));

  const withSquads = applyEspnTourSquads(
    {
      ...cached,
      tour,
      card: tourToCard(tour, 0),
      matches,
      venues: uniqueVenuesFromMatches(matches),
    },
    squads,
  );
  const warnings = [...withSquads.warnings];
  const stale = staleSnapshotWarning(cached.fetchedAt, "Tour");
  if (stale) warnings.push(stale);

  return { ...withSquads, warnings };
}
