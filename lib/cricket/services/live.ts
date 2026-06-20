import { fetchEspnMatchCentre } from "@/lib/cricket/providers/espn-match-centre";
import {
  fetchEspnLiveBangladeshHighlights,
  liveMatchSummaryFromHighlight,
} from "@/lib/cricket/providers/espn-live";
import type { LiveMatchSummary, Scorecard } from "@/lib/cricket/types";

export async function getLiveCricketData(): Promise<{
  matches: LiveMatchSummary[];
  bangladeshMatch: LiveMatchSummary | null;
  scorecard: Scorecard | null;
  warnings: string[];
}> {
  const warnings: string[] = [];
  const highlights = await fetchEspnLiveBangladeshHighlights().catch(() => []);

  if (!highlights.length) {
    warnings.push("No live Bangladesh match on ESPNcricinfo right now.");
    return { matches: [], bangladeshMatch: null, scorecard: null, warnings };
  }

  const matches = highlights.map(liveMatchSummaryFromHighlight);
  const bangladeshMatch = matches[0] ?? null;

  let scorecard: Scorecard | null = null;
  const primary = highlights[0];
  if (primary?.matchId.startsWith("espn-")) {
    try {
      scorecard =
        (await fetchEspnMatchCentre(primary.matchId, primary.espnLeagueId))?.scorecard ?? null;
    } catch {
      warnings.push("Could not load Bangladesh live scorecard from ESPNcricinfo.");
    }
  }

  return { matches, bangladeshMatch, scorecard, warnings };
}
