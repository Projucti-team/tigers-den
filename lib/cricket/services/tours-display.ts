import { getFutureTours } from "@/lib/cricket/services/tours";
import type { Tour } from "@/lib/cricket/types";

export type TourCard = {
  id: string;
  title: string;
  description: string;
  dateRange: string;
  emoji: string;
  accent: "green" | "red";
  isHomeSeries: boolean;
};

function formatDateRange(tour: Tour): string {
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

function pickEmoji(name: string, isHome: boolean): string {
  const n = name.toLowerCase();
  if (n.includes("west indies") || n.includes("caribbean")) return "🌴";
  if (n.includes("england") || n.includes("lord")) return "👑";
  if (n.includes("australia")) return "🦘";
  if (n.includes("india")) return "🇮🇳";
  if (n.includes("south africa")) return "🦁";
  if (n.includes("pakistan")) return "🇵🇰";
  if (n.includes("sri lanka")) return "🇱🇰";
  if (n.includes("zimbabwe") || n.includes("ireland")) return "✈️";
  if (isHome) return "🏏";
  return "🐅";
}

export function isHomeSeries(name: string): boolean {
  return /\btour of bangladesh\b|\bin bangladesh\b/i.test(name);
}

/** Men's Bangladesh touring overseas (e.g. "Bangladesh tour of Australia"). */
export function isAwaySeries(name: string): boolean {
  if (/women/i.test(name)) return false;
  return /bangladesh tour of/i.test(name);
}

function shortenTitle(name: string): string {
  return name
    .replace(/,?\s*\d{4}(-\d{2})?$/i, "")
    .replace(/\s+tour\s+/i, " Tour ")
    .trim();
}

export function tourToCard(tour: Tour, _index: number): TourCard {
  const home = isHomeSeries(tour.name);
  return {
    id: tour.id,
    title: shortenTitle(tour.name),
    description: formatMatchTypes(tour),
    dateRange: formatDateRange(tour),
    emoji: pickEmoji(tour.name, home),
    accent: home ? "green" : "red",
    isHomeSeries: home,
  };
}

export async function getTourCards(limit = 3): Promise<{
  cards: TourCard[];
  featuredAway: TourCard | null;
  warnings: string[];
}> {
  const { tours, warnings } = await getFutureTours({ bangladeshOnly: true });
  const awayTour = tours.find((t) => isAwaySeries(t.name));
  const cards = tours.slice(0, limit).map((t, i) => tourToCard(t, i));
  return {
    cards,
    featuredAway: awayTour ? tourToCard(awayTour, 0) : null,
    warnings,
  };
}
