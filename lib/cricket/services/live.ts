import { isBangladeshTeam } from "@/lib/cricket/constants";
import {
  fetchCurrentMatches,
  fetchScorecard,
  isCricApiConfigured,
} from "@/lib/cricket/providers/cricapi";
import type { LiveMatchSummary, Scorecard } from "@/lib/cricket/types";

export function findBangladeshLiveMatch(matches: LiveMatchSummary[]) {
  const bdMatches = matches.filter((m) => {
    const teams = m.teams || m.teamInfo?.map((t) => t.name) || [];
    return teams.some((t) => isBangladeshTeam(t));
  });
  return bdMatches.find((m) => m.isLive) ?? bdMatches[0] ?? null;
}

export async function getLiveCricketData(): Promise<{
  matches: LiveMatchSummary[];
  bangladeshMatch: LiveMatchSummary | null;
  scorecard: Scorecard | null;
  warnings: string[];
}> {
  const warnings: string[] = [];

  if (!isCricApiConfigured()) {
    warnings.push("CRICKET_DATA_API_KEY is not set — live scores unavailable.");
    return { matches: [], bangladeshMatch: null, scorecard: null, warnings };
  }

  const matches = await fetchCurrentMatches();
  const bangladeshMatch = findBangladeshLiveMatch(matches);

  let scorecard: Scorecard | null = null;
  if (bangladeshMatch?.id) {
    try {
      scorecard = await fetchScorecard(bangladeshMatch.id);
    } catch {
      warnings.push("Could not load Bangladesh live scorecard.");
    }
  }

  return { matches, bangladeshMatch, scorecard, warnings };
}
