import { espnEventIdFromMatchId } from "@/lib/cricket/providers/espn-core";
import { fetchEspnMatchCentre } from "@/lib/cricket/providers/espn-match-centre";
import type { Scorecard } from "@/lib/cricket/types";

export function isEspnMatchId(matchId: string): boolean {
  return Boolean(espnEventIdFromMatchId(matchId));
}

/** Ball-by-ball scorecard from ESPNcricinfo — no CricAPI quota. */
export async function fetchScorecardForMatch(matchId: string): Promise<Scorecard> {
  if (!isEspnMatchId(matchId)) {
    throw new Error("Scorecards are served from ESPNcricinfo (match id must start with espn-).");
  }

  const centre = await fetchEspnMatchCentre(matchId);
  if (!centre?.scorecard) {
    throw new Error("Scorecard not available from ESPNcricinfo for this match.");
  }

  return centre.scorecard;
}
