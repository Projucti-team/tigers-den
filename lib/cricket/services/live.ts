import { fetchEspnMatchCentre } from "@/lib/cricket/providers/espn-match-centre";
import { liveMatchSummaryFromHighlight } from "@/lib/cricket/providers/espn-live";
import { getLiveBangladeshHighlight } from "@/lib/cricket/services/bangladesh-last-match";
import type { LiveMatchSummary, Scorecard } from "@/lib/cricket/types";

export async function getLiveCricketData(): Promise<{
  matches: LiveMatchSummary[];
  bangladeshMatch: LiveMatchSummary | null;
  scorecard: Scorecard | null;
  warnings: string[];
}> {
  const warnings: string[] = [];
  const highlight = await getLiveBangladeshHighlight();

  if (!highlight) {
    warnings.push("No live Bangladesh match on ESPNcricinfo right now.");
    return { matches: [], bangladeshMatch: null, scorecard: null, warnings };
  }

  const bangladeshMatch = liveMatchSummaryFromHighlight(highlight);
  const matches = [bangladeshMatch];

  let scorecard: Scorecard | null = null;
  if (highlight.matchId.startsWith("espn-")) {
    try {
      scorecard = (await fetchEspnMatchCentre(highlight.matchId))?.scorecard ?? null;
    } catch {
      warnings.push("Could not load Bangladesh live scorecard from ESPNcricinfo.");
    }
  }

  return { matches, bangladeshMatch, scorecard, warnings };
}
