import { fetchCurrentMatches, isCricApiConfigured } from "@/lib/cricket/providers/cricapi";
import { matchCategoryPriority } from "@/lib/cricket/match-category";
import {
  classifyMatchStatus,
  type RawCricApiMatch,
} from "@/lib/cricket/services/bangladesh-schedule-map";
import {
  readLastCompletedBangladeshMatch,
  readLiveBangladeshMatches,
  readUpcomingBangladeshMatches,
  type BangladeshMatchRow,
} from "@/lib/cricket/services/bangladesh-matches-db";
import type { MatchHighlight } from "@/lib/cricket/services/match-highlight";
import type { LiveMatchSummary } from "@/lib/cricket/types";

const UPCOMING_DEFAULT_LIMIT = 5;
const LIVE_SCORE_CACHE_MS = 60_000;

let liveScoreCache: { at: number; byMatchId: Map<string, RawCricApiMatch> } | null = null;

/**
 * bangladesh_matches is refreshed by the periodic sync job (same cadence as the rest of the
 * cricket cron), too infrequent for a genuinely live score. So a row flagged "live" gets one
 * fresh CricAPI lookup here at read time -- short-cached so concurrent visitors during a live
 * match don't each trigger their own CricAPI call.
 */
async function freshCricApiMatchesById(): Promise<Map<string, RawCricApiMatch>> {
  if (liveScoreCache && Date.now() - liveScoreCache.at < LIVE_SCORE_CACHE_MS) {
    return liveScoreCache.byMatchId;
  }
  if (!isCricApiConfigured()) return new Map();

  const matches = await fetchCurrentMatches().catch(() => [] as LiveMatchSummary[]);
  const byMatchId = new Map<string, RawCricApiMatch>();
  for (const m of matches) {
    if (!m.id) continue;
    byMatchId.set(`cricapi-${m.id}`, {
      id: m.id,
      name: m.name,
      matchType: m.matchType,
      status: m.status,
      date: m.date,
      dateTimeGMT: m.dateTimeGMT,
      teams: m.teams,
      score: m.score,
      isLive: m.isLive,
      seriesId: m.seriesId,
      seriesName: m.seriesName,
    });
  }

  liveScoreCache = { at: Date.now(), byMatchId };
  return byMatchId;
}

function formatScoreSummary(match: RawCricApiMatch): string | undefined {
  if (!match.score?.length) return undefined;
  return match.score
    .map((inn) => `${inn.inning ? `${inn.inning}: ` : ""}${inn.r}/${inn.w} (${inn.o})`)
    .join(" · ");
}

/** Overlay a fresh CricAPI read onto a DB row flagged live, so the score isn't stuck at the last sync. */
async function enrichLiveRow(row: BangladeshMatchRow): Promise<BangladeshMatchRow> {
  const byMatchId = await freshCricApiMatchesById();
  const fresh = byMatchId.get(row.match_id);
  if (!fresh) return row;

  return {
    ...row,
    status: classifyMatchStatus(fresh),
    status_text: fresh.status || row.status_text,
    score_summary: formatScoreSummary(fresh) ?? row.score_summary,
  };
}

function rowToMatchHighlight(row: BangladeshMatchRow): MatchHighlight {
  const teams = row.teams ?? [];
  const title =
    teams.length >= 2
      ? teams.join(" vs ")
      : [row.series_name, row.opponent ? `vs ${row.opponent}` : null].filter(Boolean).join(" ") ||
        row.match_id;

  return {
    mode: row.status === "live" ? "live" : "completed",
    matchId: row.match_id,
    title,
    scoreLine: row.score_summary ?? row.status_text ?? "",
    detailLine: row.status_text ?? "",
    scores: [],
    venue: row.venue ? { name: row.venue } : undefined,
    category: row.team_category,
    priority: matchCategoryPriority(row.team_category),
    espnLeagueId: row.espn_league_id ?? undefined,
    leagueLabel: row.series_name ?? undefined,
  };
}

function rowToLiveMatchSummary(row: BangladeshMatchRow): LiveMatchSummary {
  const teams = row.teams ?? undefined;
  return {
    id: row.match_id,
    name: teams?.length ? teams.join(" vs ") : row.series_name || "Bangladesh match",
    matchType: row.match_type ?? undefined,
    status: row.status_text ?? row.status,
    venue: row.venue ?? undefined,
    date: row.match_date ? row.match_date.slice(0, 10) : undefined,
    dateTimeGMT: row.match_date ?? undefined,
    teams,
    isLive: row.status === "live",
    seriesId: row.series_id ?? undefined,
    seriesName: row.series_name ?? undefined,
  };
}

/**
 * Every currently-live Bangladesh-team match (any category), highest priority first, score
 * refreshed at read time. This is the DB-backed replacement for
 * getLiveMatchHighlights()'s international portion — domestic tracked-player matches are added
 * back in by match-highlight.ts, since those still come from the live ESPN league scan.
 */
export async function getBangladeshLiveHighlights(): Promise<MatchHighlight[]> {
  const rows = await readLiveBangladeshMatches().catch(() => []);
  if (!rows.length) return [];
  const enriched = await Promise.all(rows.map(enrichLiveRow));
  // A row can flip to "completed" between sync runs (enrichLiveRow re-classifies from a fresh
  // CricAPI read) -- don't present a just-finished match as still live.
  return enriched.filter((row) => row.status === "live").map(rowToMatchHighlight);
}

/** Most recent completed Bangladesh-team result (any category) -- DB-backed replacement for
 * getRecentBangladeshMatchHighlight(). */
export async function getBangladeshLastResultHighlight(): Promise<MatchHighlight | null> {
  const row = await readLastCompletedBangladeshMatch().catch(() => null);
  return row ? rowToMatchHighlight(row) : null;
}

/** Next N upcoming Bangladesh-team fixtures (any category), soonest first. */
export async function getBangladeshUpcomingMatches(
  limit = UPCOMING_DEFAULT_LIMIT,
): Promise<LiveMatchSummary[]> {
  const rows = await readUpcomingBangladeshMatches(limit).catch(() => []);
  return rows.map(rowToLiveMatchSummary);
}
