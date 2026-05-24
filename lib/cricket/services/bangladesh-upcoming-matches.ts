import {
  fetchCurrentMatches,
  fetchMatchesList,
  isCricApiConfigured,
} from "@/lib/cricket/providers/cricapi";
import {
  readBangladeshUpcomingMatches,
  writeBangladeshUpcomingMatches,
  type BangladeshUpcomingMatchesSnapshot,
} from "@/lib/cricket/upcoming-matches-store";
import { isUpcomingBangladeshMatch } from "@/lib/cricket/services/marquee-format";
import { matchTime } from "@/lib/cricket/services/match-highlight";
import type { LiveMatchSummary } from "@/lib/cricket/types";

const UPCOMING_LIMIT = 5;

async function fetchAllMatchesForScrape(): Promise<LiveMatchSummary[]> {
  const [current, listed] = await Promise.all([
    fetchCurrentMatches().catch(() => []),
    fetchMatchesList(16).catch(() => []),
  ]);

  const byId = new Map<string, LiveMatchSummary>();
  for (const m of [...current, ...listed]) {
    if (m.id) byId.set(m.id, m);
  }
  return [...byId.values()];
}

export function findUpcomingBangladeshMatches(
  matches: LiveMatchSummary[],
  limit = UPCOMING_LIMIT,
): LiveMatchSummary[] {
  return matches
    .filter((m) => isUpcomingBangladeshMatch(m))
    .sort((a, b) => matchTime(a) - matchTime(b))
    .slice(0, limit);
}

export async function scrapeBangladeshUpcomingMatches(): Promise<BangladeshUpcomingMatchesSnapshot | null> {
  if (!isCricApiConfigured()) {
    throw new Error("CRICKET_DATA_API_KEY is not set.");
  }

  const matches = await fetchAllMatchesForScrape();
  const upcoming = findUpcomingBangladeshMatches(matches);

  if (!upcoming.length) {
    return readBangladeshUpcomingMatches();
  }

  const snapshot: BangladeshUpcomingMatchesSnapshot = {
    fetchedAt: new Date().toISOString(),
    source: "cricapi",
    matches: upcoming,
  };

  await writeBangladeshUpcomingMatches(snapshot);
  return snapshot;
}

export async function getCachedUpcomingBangladeshMatches(): Promise<LiveMatchSummary[]> {
  const cached = await readBangladeshUpcomingMatches();
  return cached?.matches ?? [];
}
