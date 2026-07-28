import { tourPath } from "@/lib/cricket/tour-slug";
import type { Tour } from "@/lib/cricket/types";

function tourSlugFromPath(tour: Tour): string {
  return tourPath(tour).replace(/^\/tours\//, "");
}

/**
 * Pure filtering step, deliberately kept dependency-free (only tour-slug.ts + types, no
 * Payload/DB imports) so it's directly unit-testable without pulling in the whole Payload
 * config. Keep only tours whose slug is in the published set.
 *
 * Tour discovery is intentionally loose (matches anything ESPN/CricAPI mentions alongside
 * "Bangladesh" -- emerging players, unofficial women's series, franchise leagues, etc.), and a
 * discovered tour doesn't always end up with a working detail page (the build can fail, or
 * come back with zero matches). Only link a tour once its page actually exists with at least
 * one real match -- otherwise every list of tours (nav dropdown, homepage cards) can point at
 * a 404. See lib/cricket/snapshot-db.ts readTourDetailSlugsWithMatches() for how the published
 * set is computed.
 */
export function filterToursByPublishedSlugs(tours: Tour[], publishedSlugs: Set<string>): Tour[] {
  return tours.filter((tour) => publishedSlugs.has(tourSlugFromPath(tour)));
}
