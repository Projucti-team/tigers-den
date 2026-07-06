import type { Tour } from "@/lib/cricket/types";
import type { TourDetailSnapshot } from "@/lib/cricket/snapshot-types";
import type { MatchType } from "@/lib/cricket/tour-sync-state-types";
import {
  getSquadRefreshTargets,
  upsertTourSyncState,
  readTourSyncState,
} from "@/lib/cricket/services/tour-sync-state-db";
import { readCricketSnapshot, upsertCricketSnapshot } from "@/lib/cricket/snapshot-db";
import { CRICKET_SNAPSHOT_KEYS } from "@/lib/cricket/snapshot-keys";
import { refreshEspnTourSquads } from "@/lib/cricket/providers/espn-squads";
import { applyEspnTourSquads } from "@/lib/cricket/providers/espn-squads";
import { tourSlug } from "@/lib/cricket/tour-slug";
import { sanitizeTourSnapshotForRead } from "@/lib/cricket/tour-detail-sanitize";
import { squadBelongsToTour } from "@/lib/cricket/tour-identity";

export type RefreshSquadsResult = {
  ok: boolean;
  toursProcessed: number;
  formatsUpdated: number;
  warnings: string[];
  errors: string[];
};

/**
 * Fetch ESPN squads only when missing or changed.
 * Compare available squads from ESPN with what we have.
 * Skip sync if squads match.
 */
export async function refreshSquadsForActiveTours(): Promise<RefreshSquadsResult> {
  const warnings: string[] = [];
  const errors: string[] = [];
  let toursProcessed = 0;
  let formatsUpdated = 0;

  try {
    const targets = await getSquadRefreshTargets();

    if (targets.length === 0) {
      console.log("[cricket] No tours need squad refresh");
      return { ok: true, toursProcessed: 0, formatsUpdated: 0, warnings, errors };
    }

    console.log(`[cricket] Checking squads for ${targets.length} tour(s)`);

    for (const target of targets) {
      try {
        const tourState = await readTourSyncState(target.tour_id);
        if (!tourState) {
          warnings.push(`Tour ${target.tour_id} not in sync state`);
          continue;
        }

        const tourDetailKey = CRICKET_SNAPSHOT_KEYS.tourDetail(target.tour_slug);
        const tourDetail = await readCricketSnapshot<TourDetailSnapshot>(tourDetailKey);
        if (!tourDetail) {
          warnings.push(`Tour detail not found for ${target.tour_slug}`);
          continue;
        }

        const tour = tourDetail.tour;
        if (!tour) {
          warnings.push(`Tour metadata missing in detail for ${target.tour_slug}`);
          continue;
        }

        // Fetch squads from ESPN
        const { squads: newSquads, warnings: squadWarnings } = await refreshEspnTourSquads(tour);
        if (squadWarnings.length > 0) {
          warnings.push(...squadWarnings);
        }

        // Check if squads match existing ones
        const existingSquads = tourDetail.squads.filter((squad) => squadBelongsToTour(squad, tour));
        const squadsMatch = squadsAreEqual(existingSquads, newSquads);

        if (squadsMatch) {
          console.log(`[cricket] Squads unchanged for ${target.tour_slug}, skipping sync`);
          // Still mark as complete since we verified they match
          const stateUpdates: Record<string, boolean | string> = {
            tour_id: target.tour_id,
            tour_slug: target.tour_slug,
          };
          for (const matchType of target.matchTypes) {
            const completeKey = `squad_import_complete_${matchType}`;
            stateUpdates[completeKey] = true;
          }
          await upsertTourSyncState(stateUpdates as any);
          toursProcessed += 1;
          continue;
        }

        // Squads changed or missing - update
        console.log(`[cricket] Squads changed for ${target.tour_slug}, syncing...`);
        const withFreshSquads = applyEspnTourSquads(tourDetail, newSquads, squadWarnings);
        const updatedDetail: TourDetailSnapshot = {
          ...withFreshSquads,
          slug: target.tour_slug,
          fetchedAt: new Date().toISOString(),
        };

        const sanitized = sanitizeTourSnapshotForRead(tour, updatedDetail);
        const squads = updatedDetail.squads.filter((squad) => squadBelongsToTour(squad, tour));
        const finalDetail: TourDetailSnapshot = {
          ...updatedDetail,
          matches: sanitized.matches,
          venues: sanitized.venues,
          squads,
        };

        await upsertCricketSnapshot(tourDetailKey, `Tour: ${tour.name}`, finalDetail);

        const stateUpdates: Record<string, boolean | string> = {
          tour_id: target.tour_id,
          tour_slug: target.tour_slug,
        };

        for (const matchType of target.matchTypes) {
          const syncKey = `last_squad_sync_${matchType}`;
          const completeKey = `squad_import_complete_${matchType}`;
          stateUpdates[syncKey] = new Date().toISOString();
          stateUpdates[completeKey] = true;
          formatsUpdated += 1;
        }

        await upsertTourSyncState(stateUpdates as any);
        toursProcessed += 1;
      } catch (e) {
        errors.push(
          `Tour ${target.tour_slug}: ${e instanceof Error ? e.message : "squad refresh failed"}`,
        );
      }
    }

    console.log(
      `[cricket] Squad refresh complete: ${toursProcessed} tour(s), ${formatsUpdated} format(s) updated`,
    );
  } catch (e) {
    return {
      ok: false,
      toursProcessed,
      formatsUpdated,
      warnings,
      errors: [e instanceof Error ? e.message : "Squad refresh failed"],
    };
  }

  return {
    ok: errors.length === 0,
    toursProcessed,
    formatsUpdated,
    warnings,
    errors,
  };
}

/**
 * Check if two squad lists are equivalent.
 * Compares squad names and team composition.
 */
function squadsAreEqual(existing: any[], fetched: any[]): boolean {
  if (existing.length !== fetched.length) return false;

  const existingKeys = existing.map((s) => `${s.team || s.name}`).sort();
  const fetchedKeys = fetched.map((s) => `${s.team || s.name}`).sort();

  return existingKeys.join(",") === fetchedKeys.join(",");
}
