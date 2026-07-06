import type { Tour, LiveMatchSummary } from "@/lib/cricket/types";
import type { ToursIndexSnapshot, TourDetailSnapshot } from "@/lib/cricket/snapshot-types";
import type { MatchType, SquadRefreshTarget } from "@/lib/cricket/tour-sync-state-types";
import {
  readTourSyncState,
  upsertTourSyncState,
  readAllTourSyncStates,
} from "@/lib/cricket/services/tour-sync-state-db";
import { tourSlug } from "@/lib/cricket/tour-slug";

const ACTIVE_TOUR_WINDOW_DAYS = 30;

type SeriesFormatStatus = "upcoming" | "active" | "finished";

interface TourFormatDates {
  test?: { startDate: Date; endDate?: Date };
  odi?: { startDate: Date; endDate?: Date };
  t20?: { startDate: Date; endDate?: Date };
}

function getFormatDates(matches: LiveMatchSummary[]): TourFormatDates {
  const formatDates: TourFormatDates = {};

  for (const match of matches) {
    if (!match.matchType || !match.date) continue;

    const matchType = match.matchType.toLowerCase();
    if (matchType !== "test" && matchType !== "odi" && matchType !== "t20") continue;

    const startDate = new Date(match.date);
    const key = matchType as MatchType;

    if (!formatDates[key]) {
      formatDates[key] = { startDate, endDate: startDate };
    } else {
      const existing = formatDates[key];
      if (startDate < existing.startDate) {
        existing.startDate = startDate;
      }
      if (!existing.endDate || startDate > existing.endDate) {
        existing.endDate = startDate;
      }
    }
  }

  return formatDates;
}

function determineFormatStatus(formatDates: TourFormatDates[MatchType] | undefined): SeriesFormatStatus | null {
  if (!formatDates) return null;

  const now = new Date();

  if (formatDates.startDate > now) {
    return "upcoming";
  }

  if (formatDates.endDate && formatDates.endDate < now) {
    return "finished";
  }

  return "active";
}

function isTourActive(tour: Tour): boolean {
  const now = new Date();
  const activeWindowEnd = new Date(now.getTime() + ACTIVE_TOUR_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  if (tour.startDate) {
    const startDate = new Date(tour.startDate);
    if (startDate >= now && startDate <= activeWindowEnd) {
      return true;
    }
  }

  if (tour.endDate) {
    const endDate = new Date(tour.endDate);
    if (endDate >= now) {
      return true;
    }
  }

  return false;
}

/**
 * Mark tours no longer in index as finished.
 */
export async function markFinishedTours(toursIndex: ToursIndexSnapshot): Promise<void> {
  const existingStates = await readAllTourSyncStates();
  const toursInIndex = new Set(toursIndex.tours.map((t) => t.id));

  for (const existing of existingStates) {
    if (!toursInIndex.has(existing.tour_id) && existing.current_status === "active") {
      await upsertTourSyncState({
        tour_id: existing.tour_id,
        tour_slug: existing.tour_slug,
        current_status: "finished",
      });
    }
  }
}

/**
 * Update series format status for a tour based on its match details.
 * Returns match types needing squad refresh.
 */
export async function updateTourFormatStatus(
  tour: Tour,
  tourDetail: TourDetailSnapshot,
): Promise<MatchType[]> {
  const slug = tourSlug(tour);
  const existing = await readTourSyncState(tour.id);
  const formatDates = getFormatDates(tourDetail.matches);
  const active = isTourActive(tour);

  const testStatus = determineFormatStatus(formatDates.test);
  const odiStatus = determineFormatStatus(formatDates.odi);
  const t20Status = determineFormatStatus(formatDates.t20);

  const matchTypes: MatchType[] = [];
  if (testStatus === "upcoming" && !existing?.squad_import_complete_test) {
    matchTypes.push("test");
  }
  if (odiStatus === "upcoming" && !existing?.squad_import_complete_odi) {
    matchTypes.push("odi");
  }
  if (t20Status === "upcoming" && !existing?.squad_import_complete_t20) {
    matchTypes.push("t20");
  }

  const status = active ? "active" : "finished";
  console.log(`[cricket] ${slug}: status=${status}, formats=[test:${testStatus}, odi:${odiStatus}, t20:${t20Status}]`);

  await upsertTourSyncState({
    tour_id: tour.id,
    tour_slug: slug,
    current_status: status,
    test_series_status: testStatus,
    odi_series_status: odiStatus,
    t20_series_status: t20Status,
    last_index_sync: new Date().toISOString(),
  });

  return matchTypes;
}

/**
 * Initialize tour_sync_state for new tours from index (no format info yet).
 */
export async function initializeTourSyncState(toursIndex: ToursIndexSnapshot): Promise<void> {
  for (const tour of toursIndex.tours) {
    const slug = tourSlug(tour);
    const existing = await readTourSyncState(tour.id);

    if (!existing) {
      await upsertTourSyncState({
        tour_id: tour.id,
        tour_slug: slug,
        current_status: isTourActive(tour) ? "active" : "finished",
        last_index_sync: new Date().toISOString(),
      });
    }
  }
}
