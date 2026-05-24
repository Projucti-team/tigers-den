import { buildFutureToursLive } from "@/lib/cricket/services/tours";
import { shortenTitle, tourToCard } from "@/lib/cricket/services/tours-display";
import type { ToursIndexSnapshot } from "@/lib/cricket/snapshot-types";
import { tourPath } from "@/lib/cricket/tour-slug";
import { isAwaySeries } from "@/lib/cricket/services/tours-display";

/** Live build — only used by the nightly sync job. */
export async function buildToursIndexLive(): Promise<ToursIndexSnapshot> {
  const { tours, warnings } = await buildFutureToursLive({ bangladeshOnly: true });
  const cards = tours.map((t, i) => tourToCard(t, i));
  const navLinks = tours.map((tour) => ({
    label: shortenTitle(tour.name),
    href: tourPath(tour),
  }));

  return {
    fetchedAt: new Date().toISOString(),
    tours,
    cards,
    navLinks,
    warnings,
  };
}

export function featuredAwayFromIndex(snapshot: ToursIndexSnapshot) {
  const awayTour = snapshot.tours.find((t) => isAwaySeries(t.name));
  if (!awayTour) return null;
  const idx = snapshot.tours.findIndex((t) => t.id === awayTour.id);
  return snapshot.cards[idx] ?? null;
}
