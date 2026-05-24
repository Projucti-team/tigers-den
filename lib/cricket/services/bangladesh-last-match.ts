import {
  fetchCurrentMatches,
  fetchMatchesList,
  isCricApiConfigured,
} from "@/lib/cricket/providers/cricapi";
import {
  readBangladeshLastMatch,
  writeBangladeshLastMatch,
  type BangladeshLastMatchSnapshot,
} from "@/lib/cricket/bangladesh-match-store";
import { CRICKET_SNAPSHOT_KEYS } from "@/lib/cricket/snapshot-keys";
import { readCricketSnapshot } from "@/lib/cricket/snapshot-db";
import { isPayloadConfigured } from "@/lib/payload";
import type { LiveMatchSummary } from "@/lib/cricket/types";
import {
  findLastBangladeshMatch,
  findLiveBangladeshMatch,
  matchToHighlight,
  type MatchHighlight,
} from "@/lib/cricket/services/match-highlight";

async function fetchAllMatchesForScrape(): Promise<LiveMatchSummary[]> {
  const [current, listed] = await Promise.all([
    fetchCurrentMatches().catch(() => []),
    fetchMatchesList(12).catch(() => []),
  ]);

  const byId = new Map<string, LiveMatchSummary>();
  for (const m of [...current, ...listed]) {
    if (m.id) byId.set(m.id, m);
  }
  return [...byId.values()];
}

/** Refresh cache from CricAPI — run via npm script (not on every page view). */
export async function scrapeBangladeshLastMatch(): Promise<BangladeshLastMatchSnapshot | null> {
  if (!isCricApiConfigured()) {
    throw new Error("CRICKET_DATA_API_KEY is not set.");
  }

  const matches = await fetchAllMatchesForScrape();
  const last = findLastBangladeshMatch(matches);

  if (!last) {
    const existing = await readBangladeshLastMatch();
    return existing;
  }

  const snapshot: BangladeshLastMatchSnapshot = {
    fetchedAt: new Date().toISOString(),
    source: "cricapi",
    highlight: matchToHighlight(last, "completed"),
    raw: last,
  };

  await writeBangladeshLastMatch(snapshot);
  return snapshot;
}

export async function getCachedBangladeshLastMatch(): Promise<MatchHighlight | null> {
  if (isPayloadConfigured()) {
    const cached = await readCricketSnapshot<BangladeshLastMatchSnapshot>(
      CRICKET_SNAPSHOT_KEYS.lastMatch,
    );
    if (cached?.highlight) return cached.highlight;
  }

  const file = await readBangladeshLastMatch();
  return file?.highlight ?? null;
}

/** One lightweight API call for live; last result always from cache. */
export async function getLiveBangladeshHighlight(): Promise<MatchHighlight | null> {
  if (!isCricApiConfigured()) return null;

  try {
    const current = await fetchCurrentMatches();
    const live = findLiveBangladeshMatch(current);
    if (live) return matchToHighlight(live, "live");
    return null;
  } catch {
    return null;
  }
}
