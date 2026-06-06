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
import { CRICKET_SNAPSHOT_KEYS } from "@/lib/cricket/snapshot-keys";
import { readCricketSnapshot } from "@/lib/cricket/snapshot-db";
import { isPayloadConfigured } from "@/lib/payload";
import { isUpcomingBangladeshMatch } from "@/lib/cricket/services/marquee-format";
import { matchTime } from "@/lib/cricket/services/match-highlight";
import type { LiveMatchSummary } from "@/lib/cricket/types";

const UPCOMING_LIMIT = 5;


export function findUpcomingBangladeshMatches(
  matches: LiveMatchSummary[],
  limit = UPCOMING_LIMIT,
): LiveMatchSummary[] {
  return matches
    .filter((m) => isUpcomingBangladeshMatch(m))
    .sort((a, b) => matchTime(a) - matchTime(b))
    .slice(0, limit);
}

export async function scrapeBangladeshUpcomingMatches(
  prefetchedMatches?: LiveMatchSummary[],
): Promise<BangladeshUpcomingMatchesSnapshot | null> {
  if (!isCricApiConfigured()) {
    throw new Error("CRICKET_DATA_API_KEY is not set.");
  }

  let matches = prefetchedMatches;
  if (!matches?.length) {
    const [current, listed] = await Promise.all([
      fetchCurrentMatches().catch(() => []),
      fetchMatchesList(3).catch(() => []),
    ]);
    const byId = new Map<string, LiveMatchSummary>();
    for (const m of [...current, ...listed]) {
      if (m.id) byId.set(m.id, m);
    }
    matches = [...byId.values()];
  }
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
  if (isPayloadConfigured()) {
    const cached = await readCricketSnapshot<BangladeshUpcomingMatchesSnapshot>(
      CRICKET_SNAPSHOT_KEYS.upcomingMatches,
    );
    if (cached?.matches?.length) return cached.matches;
  }

  const file = await readBangladeshUpcomingMatches();
  return file?.matches ?? [];
}
