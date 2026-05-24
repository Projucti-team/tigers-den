import type { Tour } from "@/lib/cricket/types";

export function tourSlug(tour: Tour): string {
  const base = tour.name
    .toLowerCase()
    .replace(/,?\s*\d{4}(-\d{2})?$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return `${base || "series"}-${tour.id}`;
}

export function tourPath(tour: Tour): string {
  return `/tours/${tourSlug(tour)}`;
}

export function findTourBySlug(tours: Tour[], slug: string): Tour | undefined {
  return tours.find((t) => tourSlug(t) === slug);
}
