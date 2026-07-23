import { fetchCricApiTourSquads } from "@/lib/cricket/providers/cricapi";
import { refreshEspnTourSquads } from "@/lib/cricket/providers/espn-squads";
import type { SeriesSquad } from "@/lib/cricket/squads/types";
import type { Tour } from "@/lib/cricket/types";

/**
 * ESPNcricinfo first — most reliable once published. Falls back to CricAPI so an
 * officially-announced squad shows on the site even before ESPNcricinfo catches up.
 * Every sync job that pulls squads live should go through this instead of calling
 * refreshEspnTourSquads directly.
 */
export async function refreshTourSquads(tour: Tour): Promise<{
  squads: SeriesSquad[];
  warnings: string[];
}> {
  const { squads: espnSquads, warnings: espnWarnings } = await refreshEspnTourSquads(tour);
  if (espnSquads.length) {
    return { squads: espnSquads, warnings: espnWarnings };
  }

  const { squads: cricapiSquads, warnings: cricapiWarnings } = await fetchCricApiTourSquads(tour);
  if (cricapiSquads.length) {
    const warnings = [
      ...espnWarnings.filter(
        (w) => !w.startsWith("Squads not published") && !w.startsWith("Could not match this series"),
      ),
      "Squads sourced from CricAPI (not yet published on ESPNcricinfo).",
    ];
    return { squads: cricapiSquads, warnings };
  }

  return { squads: espnSquads, warnings: [...espnWarnings, ...cricapiWarnings] };
}
