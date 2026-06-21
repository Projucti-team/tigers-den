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
import { readTourDetailSnapshot } from "@/lib/cricket/tour-detail-store";
import { findTourBySlug } from "@/lib/cricket/tour-slug";
import { sortMatchesByDate } from "@/lib/cricket/match-sort";

export type { TourDetail } from "@/lib/cricket/tour-detail-types";

async function readStoredTourDetail(slug: string): Promise<TourDetailSnapshot | null> {
  const fromDb = await readCricketSnapshot<TourDetailSnapshot>(
    CRICKET_SNAPSHOT_KEYS.tourDetail(slug),
  );
  if (fromDb) return fromDb;

  return readTourDetailSnapshot(slug);
}

/** Read pre-built tour page from DB or job-written JSON — no live fixture fetches. */
export async function getTourDetail(slug: string): Promise<TourDetailSnapshot | null> {
  const cached = await readStoredTourDetail(slug);
  if (!cached) return null;

  const { tours } = await getFutureTours({ bangladeshOnly: true });
  const umbrella = findTourBySlug(tours, slug);
  const tour = umbrella ?? cached.tour;

  const espnSquads = await loadEspnTourSquadsFromCache(tour);
  const mergedSquads = mergeSquads(cached.squads, espnSquads);
  const squads = await Promise.all(
    mergedSquads.map(async (squad) => ({
      ...squad,
      players: await enrichSquadPlayersForDisplay(squadPrimaryNation(squad.team), squad.players),
    })),
  );

  const withSquads = applyEspnTourSquads(
    {
      ...cached,
      tour,
      card: tourToCard(tour, 0),
      matches: sortMatchesByDate(cached.matches),
    },
    squads,
  );
  const warnings = [...withSquads.warnings];
  const stale = staleSnapshotWarning(cached.fetchedAt, "Tour");
  if (stale) warnings.push(stale);

  return { ...withSquads, warnings };
}
