import {
  buildCuratedUpcomingBangladeshMatches,
  enrichUpcomingMatchFixtureTimes,
} from "@/lib/cricket/providers/espn-fixtures";
import { fetchEspnUpcomingBangladeshMatchesFromEvents } from "@/lib/cricket/providers/espn-live";
import {
  readBangladeshUpcomingMatches,
  writeBangladeshUpcomingMatches,
  type BangladeshUpcomingMatchesSnapshot,
} from "@/lib/cricket/upcoming-matches-store";
import { CRICKET_SNAPSHOT_KEYS } from "@/lib/cricket/snapshot-keys";
import { readCricketSnapshot } from "@/lib/cricket/snapshot-db";
import { isPayloadConfigured } from "@/lib/payload-env";
import { isUpcomingBangladeshMatch } from "@/lib/cricket/services/marquee-format";
import { matchTime } from "@/lib/cricket/services/match-highlight";
import type { LiveMatchSummary } from "@/lib/cricket/types";

const UPCOMING_LIMIT = 5;
/** Merged cache can hold more — e.g. men's tour + women's fixtures side by side. */
const UPCOMING_MERGED_LIMIT = 8;
/** Grace before a fixture counts as started (clock skew, delayed toss). */
const UPCOMING_GRACE_MS = 15 * 60 * 1000;

function isStillUpcoming(match: LiveMatchSummary): boolean {
  return matchTime(match) > Date.now() - UPCOMING_GRACE_MS;
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

async function fetchEspnUpcomingBangladeshMatches(
  limit = UPCOMING_MERGED_LIMIT,
): Promise<LiveMatchSummary[]> {
  const [curated, events] = await Promise.all([
    buildCuratedUpcomingBangladeshMatches(limit),
    fetchEspnUpcomingBangladeshMatchesFromEvents(limit),
  ]);

  const byId = new Map<string, LiveMatchSummary>();
  for (const match of [...events, ...curated]) {
    if (match.id && !byId.has(match.id)) byId.set(match.id, match);
  }

  return [...byId.values()]
    .filter(isStillUpcoming)
    .sort((a, b) => matchTime(a) - matchTime(b))
    .slice(0, limit);
}

/** Refresh upcoming marquee cache from ESPNcricinfo. */
export async function scrapeBangladeshUpcomingMatches(): Promise<BangladeshUpcomingMatchesSnapshot | null> {
  const upcoming = await enrichUpcomingMatchFixtureTimes(
    await fetchEspnUpcomingBangladeshMatches(UPCOMING_MERGED_LIMIT),
  );

  // ESPN lists can be partial — merge with cached fixtures still in the future
  // so a bad scrape never wipes known upcoming matches.
  const [previousCached, previousFile] = await Promise.all([
    getCachedUpcomingBangladeshMatches().catch(() => []),
    readBangladeshUpcomingMatches().catch(() => null),
  ]);
  const byId = new Map<string, LiveMatchSummary>();
  for (const m of [...upcoming, ...previousCached, ...(previousFile?.matches ?? [])]) {
    if (m.id && !byId.has(m.id)) byId.set(m.id, m);
  }
  const merged = [...byId.values()]
    .filter(isStillUpcoming)
    .sort((a, b) => matchTime(a) - matchTime(b))
    .slice(0, UPCOMING_MERGED_LIMIT);

  if (!merged.length) {
    const fallback = await readBangladeshUpcomingMatches();
    if (!fallback?.matches?.length) return fallback;
    return {
      ...fallback,
      matches: await enrichUpcomingMatchFixtureTimes(fallback.matches),
    };
  }

  const snapshot: BangladeshUpcomingMatchesSnapshot = {
    fetchedAt: new Date().toISOString(),
    source: "espn",
    matches: merged,
  };

  await writeBangladeshUpcomingMatches(snapshot);
  return snapshot;
}

export async function getCachedUpcomingBangladeshMatches(): Promise<LiveMatchSummary[]> {
  let matches: LiveMatchSummary[] = [];

  if (isPayloadConfigured()) {
    const cached = await readCricketSnapshot<BangladeshUpcomingMatchesSnapshot>(
      CRICKET_SNAPSHOT_KEYS.upcomingMatches,
    );
    if (cached?.matches?.length) matches = cached.matches;
  }

  if (!matches.length) {
    const file = await readBangladeshUpcomingMatches();
    matches = file?.matches ?? [];
  }

  // Drop fixtures that have already started — the live/last-match line covers those.
  return enrichUpcomingMatchFixtureTimes(matches.filter(isStillUpcoming));
}
