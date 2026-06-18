import { getFutureTours } from "@/lib/cricket/services/tours";
import { tourFlagIsos } from "@/lib/cricket/tour-flags";
import { tourPath } from "@/lib/cricket/tour-slug";
import type { Tour } from "@/lib/cricket/types";

export type TourCard = {
  id: string;
  slug: string;
  href: string;
  title: string;
  description: string;
  dateRange: string;
  headerFlagIso: string;
  accent: "green" | "red";
  isHomeSeries: boolean;
};

export function formatDateRange(tour: Tour): string {
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };
  const start = tour.startDate
    ? new Date(tour.startDate).toLocaleDateString("en-GB", opts)
    : null;

  if (!start) return "Dates TBC";

  if (tour.endDate && /^\d{4}-\d{2}-\d{2}/.test(tour.endDate)) {
    const end = new Date(tour.endDate).toLocaleDateString("en-GB", opts);
    return `${start} – ${end}`;
  }

  if (tour.endDate) {
    const year = tour.startDate ? new Date(tour.startDate).getFullYear() : new Date().getFullYear();
    const end = new Date(`${tour.endDate.trim()} ${year}`).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    if (!Number.isNaN(new Date(`${tour.endDate.trim()} ${year}`).getTime())) {
      return `${start} – ${end}`;
    }
  }

  return `From ${start}`;
}

function formatMatchTypes(tour: Tour): string {
  const parts: string[] = [];
  if (tour.test) parts.push(`${tour.test} Test${tour.test > 1 ? "s" : ""}`);
  if (tour.odi) parts.push(`${tour.odi} ODI${tour.odi > 1 ? "s" : ""}`);
  if (tour.t20) parts.push(`${tour.t20} T20I${tour.t20 > 1 ? "s" : ""}`);
  if (parts.length) return parts.join(" · ");
  if (tour.matches) return `${tour.matches} international${tour.matches > 1 ? "s" : ""}`;
  return "International series";
}

export function isHomeSeries(name: string): boolean {
  return /\btour of bangladesh\b|\bin bangladesh\b/i.test(name);
}

export function isAwaySeries(name: string): boolean {
  if (/women/i.test(name)) return false;
  return /bangladesh tour of/i.test(name);
}

export function shortenTitle(name: string): string {
  return name
    .replace(/,?\s*\d{4}(-\d{2})?$/i, "")
    .replace(/\s+tour\s+/i, " Tour ")
    .trim();
}

export function tourToCard(tour: Tour, _index: number): TourCard {
  const home = isHomeSeries(tour.name);
  const { headerIso } = tourFlagIsos(tour.name, home);
  return {
    id: tour.id,
    slug: tourPath(tour).replace(/^\/tours\//, ""),
    href: tourPath(tour),
    title: shortenTitle(tour.name),
    description: formatMatchTypes(tour),
    dateRange: formatDateRange(tour),
    headerFlagIso: headerIso,
    accent: home ? "green" : "red",
    isHomeSeries: home,
  };
}

/** Homepage cards — from nightly DB snapshot + confirmed ESPN schedules. */
export async function getTourCards(limit = 3): Promise<{
  cards: TourCard[];
  featuredAway: TourCard | null;
  warnings: string[];
}> {
  const { tours, warnings } = await getFutureTours({ bangladeshOnly: true });
  const cards = tours.map((t, i) => tourToCard(t, i));
  const awayTour = tours.find((t) => isAwaySeries(t.name));
  const featuredAway = awayTour
    ? cards[tours.findIndex((t) => t.id === awayTour.id)] ?? null
    : null;

  return {
    cards: cards.slice(0, limit),
    featuredAway,
    warnings,
  };
}

/** Navbar TOURS dropdown — always deduped (not stale snapshot navLinks). */
export async function getTourNavLinks(): Promise<{ label: string; href: string }[]> {
  const { tours } = await getFutureTours({ bangladeshOnly: true });
  return tours.map((tour) => ({
    label: shortenTitle(tour.name),
    href: tourPath(tour),
  }));
}
