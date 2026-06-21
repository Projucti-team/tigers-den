import {
  buildCuratedUpcomingBangladeshMatches,
  enrichUpcomingMatchFixtureTimes,
  matchDateKey,
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

function upcomingSourceRank(match: LiveMatchSummary): number {
  const id = match.id ?? "";
  if (id.startsWith("espn-curated-")) return 3;
  if (id.startsWith("espn-")) return 2;
  if (id.startsWith("seed-")) return 0;
  return 1;
}

function upcomingDedupeKey(match: LiveMatchSummary): string {
  const date = matchDateKey(match);
  const mt = (match.matchType ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const series = match.seriesId ?? match.seriesName ?? "";
  const teams = [...(match.teams ?? [])].sort().join("|");
  return `${series}|${date}|${mt}|${teams}`;
}

/** One row per fixture — prefer ESPN/curated over stale seed cache. */
function dedupeUpcomingMatches(matches: LiveMatchSummary[]): LiveMatchSummary[] {
  const byKey = new Map<string, LiveMatchSummary>();
  for (const match of matches) {
    const key = upcomingDedupeKey(match);
    const existing = byKey.get(key);
    if (!existing || upcomingSourceRank(match) > upcomingSourceRank(existing)) {
      byKey.set(key, match);
    }
  }
  return [...byKey.values()];
}

async function loadStoredUpcomingMatches(): Promise<LiveMatchSummary[]> {
  if (isPayloadConfigured()) {
    const cached = await readCricketSnapshot<BangladeshUpcomingMatchesSnapshot>(
      CRICKET_SNAPSHOT_KEYS.upcomingMatches,
    );
    if (cached?.matches?.length) return cached.matches;
  }

  const file = await readBangladeshUpcomingMatches();
  return file?.matches ?? [];
}

async function resolveUpcomingBangladeshMatches(): Promise<LiveMatchSummary[]> {
  const [freshCurated, stored] = await Promise.all([
    buildCuratedUpcomingBangladeshMatches(UPCOMING_MERGED_LIMIT).catch(() => []),
    loadStoredUpcomingMatches(),
  ]);

  // Curated schedule has correct ordinals (3rd T20, not 1st) — always merge over stale cache.
  const merged = dedupeUpcomingMatches([...freshCurated, ...stored]);
  const upcoming = merged.filter(isStillUpcoming);
  const enriched = await enrichUpcomingMatchFixtureTimes(upcoming);
  return dedupeUpcomingMatches(enriched.filter(isStillUpcoming));
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

  return dedupeUpcomingMatches(
    [...byId.values()]
      .filter(isStillUpcoming)
      .sort((a, b) => matchTime(a) - matchTime(b)),
  ).slice(0, limit);
}

/** Refresh upcoming marquee cache from ESPNcricinfo. */
export async function scrapeBangladeshUpcomingMatches(): Promise<BangladeshUpcomingMatchesSnapshot | null> {
  const upcoming = await enrichUpcomingMatchFixtureTimes(
    await fetchEspnUpcomingBangladeshMatches(UPCOMING_MERGED_LIMIT),
  );

  // ESPN lists can be partial — only fall back to the JSON seed file, not Payload cache
  // (re-reading cache would re-merge stale rows with wrong ordinals).
  const previousFile = await readBangladeshUpcomingMatches().catch(() => null);
  const byId = new Map<string, LiveMatchSummary>();
  for (const m of [...upcoming, ...(previousFile?.matches ?? [])]) {
    if (m.id && !byId.has(m.id)) byId.set(m.id, m);
  }
  const merged = dedupeUpcomingMatches(
    [...byId.values()]
      .filter(isStillUpcoming)
      .sort((a, b) => matchTime(a) - matchTime(b)),
  ).slice(0, UPCOMING_MERGED_LIMIT);

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
  return resolveUpcomingBangladeshMatches();
}
