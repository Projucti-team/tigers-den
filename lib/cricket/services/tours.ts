import { isBangladeshTeam } from "@/lib/cricket/constants";
import { fetchUpcomingTours, isCricApiConfigured } from "@/lib/cricket/providers/cricapi";
import type { Tour } from "@/lib/cricket/types";

export function filterBangladeshTours(tours: Tour[]): Tour[] {
  return tours.filter((t) => {
    const name = t.name.toLowerCase();
    if (isBangladeshTeam(name)) return true;
    if (t.teams?.some((team) => isBangladeshTeam(team))) return true;
    return false;
  });
}

export async function getFutureTours(options?: { bangladeshOnly?: boolean }): Promise<{
  tours: Tour[];
  warnings: string[];
}> {
  const warnings: string[] = [];

  if (!isCricApiConfigured()) {
    warnings.push("CRICKET_DATA_API_KEY is not set — tour fixtures unavailable.");
    return { tours: [], warnings };
  }

  try {
    let tours = await fetchUpcomingTours();
    if (options?.bangladeshOnly) {
      tours = filterBangladeshTours(tours);
    }
    return { tours, warnings };
  } catch (e) {
    warnings.push(e instanceof Error ? e.message : "Failed to fetch tours.");
    return { tours: [], warnings };
  }
}
