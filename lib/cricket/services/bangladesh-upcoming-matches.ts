import {
  fetchCurrentMatches,
  fetchMatchesList,
  isCricApiConfigured,
} from "@/lib/cricket/providers/cricapi";
import { enrichUpcomingMatchFixtureTimes } from "@/lib/cricket/providers/espn-fixtures";
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
  const upcoming = await enrichUpcomingMatchFixtureTimes(
    findUpcomingBangladeshMatches(matches),
  );

  // CricAPI's match list is flaky (quota, partial pages, mixed men's/women's
  // fixtures) — merge with cached/seeded fixtures that are still in the future
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
    source: "cricapi",
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
