import { enrichMatchFixtureTimes } from "@/lib/cricket/providers/espn-fixtures";
import {
  applyEspnTourSquads,
  loadEspnTourSquadsFromCache,
} from "@/lib/cricket/providers/espn-squads";
import { mergeSquads } from "@/lib/cricket/squads/types";
import { CRICKET_SNAPSHOT_KEYS } from "@/lib/cricket/snapshot-keys";
import { readCricketSnapshot, staleSnapshotWarning } from "@/lib/cricket/snapshot-db";
import type { TourDetailSnapshot } from "@/lib/cricket/snapshot-types";

export type { TourDetail } from "@/lib/cricket/tour-detail-types";

/** Read pre-built tour page from DB (nightly cron). */
export async function getTourDetail(slug: string): Promise<TourDetailSnapshot | null> {
  const cached = await readCricketSnapshot<TourDetailSnapshot>(
    CRICKET_SNAPSHOT_KEYS.tourDetail(slug),
  );
  if (!cached) return null;

  const espnSquads = await loadEspnTourSquadsFromCache(cached.tour);
  const squads = mergeSquads(cached.squads, espnSquads);
  const withSquads = applyEspnTourSquads(cached, squads);
  const matches = await enrichMatchFixtureTimes(withSquads.matches, { tour: cached.tour });
  const enriched = { ...withSquads, matches };
  const warnings = [...enriched.warnings];
  const stale = staleSnapshotWarning(cached.fetchedAt, "Tour");
  if (stale) warnings.push(stale);

  return { ...enriched, warnings };
}
