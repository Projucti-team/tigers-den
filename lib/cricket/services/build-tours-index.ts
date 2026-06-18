import { buildFutureToursLive, buildFutureToursFromEspnOnly } from "@/lib/cricket/services/tours";
import { inferToursSource } from "@/lib/cricket/services/tour-sync-policy";
import { getCricApiKeyWarnings, isCricApiBlocked } from "@/lib/cricket/providers/cricapi";
import { shortenTitle, tourToCard } from "@/lib/cricket/services/tours-display";
import type { ToursIndexSnapshot } from "@/lib/cricket/snapshot-types";
import { tourPath } from "@/lib/cricket/tour-slug";
import { isAwaySeries } from "@/lib/cricket/services/tours-display";
import type { LiveMatchSummary } from "@/lib/cricket/types";

/** Live build — only used by the nightly sync job. */
export async function buildToursIndexLive(options?: {
  prefetchedMatches?: LiveMatchSummary[];
  espnOnly?: boolean;
}): Promise<ToursIndexSnapshot> {
  const { tours, warnings } = options?.espnOnly
    ? await buildFutureToursFromEspnOnly({ bangladeshOnly: true })
    : await buildFutureToursLive({
        bangladeshOnly: true,
        prefetchedMatches: options?.prefetchedMatches,
      });
  const cards = tours.map((t, i) => tourToCard(t, i));
  const navLinks = tours.map((tour) => ({
    label: shortenTitle(tour.name),
    href: tourPath(tour),
  }));

  const mergedWarnings = [...new Set([...warnings, ...getCricApiKeyWarnings()])];
  const cricApiBlocked =
    isCricApiBlocked() || mergedWarnings.some((w) => /blocked|quota|rate|exhausted/i.test(w));

  return {
    fetchedAt: new Date().toISOString(),
    tours,
    cards,
    navLinks,
    warnings: mergedWarnings,
    toursSource: inferToursSource(mergedWarnings, cricApiBlocked, tours.length),
  };
}

export function featuredAwayFromIndex(snapshot: ToursIndexSnapshot) {
  const awayTour = snapshot.tours.find((t) => isAwaySeries(t.name));
  if (!awayTour) return null;
  const idx = snapshot.tours.findIndex((t) => t.id === awayTour.id);
  return snapshot.cards[idx] ?? null;
}
