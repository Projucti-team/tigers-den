import { isBangladeshTeam } from "@/lib/cricket/constants";
import {
  fetchCurrentMatches,
  fetchMatchesList,
  fetchSeriesInfo,
  isCricApiConfigured,
  searchCricApiSeries,
} from "@/lib/cricket/providers/cricapi";
import {
  isRelevantSeriesWindow,
  mapCricApiMatchToUpsertRow,
  type BangladeshTeamCategory,
  type RawCricApiMatch,
} from "@/lib/cricket/services/bangladesh-schedule-map";
import {
  upsertBangladeshMatches,
  type BangladeshMatchUpsert,
} from "@/lib/cricket/services/bangladesh-matches-db";
import type { LiveMatchSummary } from "@/lib/cricket/types";

/**
 * One search term per team category -- CricAPI's generic currentMatches/matches endpoints skew
 * toward major (men's) fixtures, so women's/u19/emerging series need to be found by name search,
 * same trick fetchUpcomingTours() already relies on for "bangladesh women".
 */
const CATEGORY_SEARCH_TERMS: Record<BangladeshTeamCategory, string[]> = {
  men: ["bangladesh"],
  women: ["bangladesh women"],
  u19: ["bangladesh under-19", "bangladesh u19"],
  emerging: ["bangladesh emerging", "bangladesh a"],
};

function toRawMatch(match: LiveMatchSummary): RawCricApiMatch | null {
  if (!match.id) return null;
  return {
    id: match.id,
    name: match.name,
    matchType: match.matchType,
    status: match.status,
    date: match.date,
    dateTimeGMT: match.dateTimeGMT,
    teams: match.teams,
    score: match.score,
    isLive: match.isLive,
    seriesId: match.seriesId,
    seriesName: match.seriesName,
  };
}

/**
 * Refreshes bangladesh_matches for every Bangladesh representative side (men, women, u19,
 * emerging) from CricAPI -- the same provider that already keeps the Tours page and WTC standings
 * fresh, unlike the old ESPN-league-discovery path this replaces which required someone to
 * hand-add a series to data/espn-fixture-times.json before it existed at all. Run via the
 * "bangladesh-schedule" sync job (replaces the old separate "last-match" and "upcoming" jobs).
 */
export async function syncBangladeshMatches(): Promise<{
  upserted: number;
  warnings: string[];
}> {
  const warnings: string[] = [];

  if (!isCricApiConfigured()) {
    return { upserted: 0, warnings: ["CRICKET_DATA_API_KEY is not configured."] };
  }

  const byMatchId = new Map<string, BangladeshMatchUpsert>();

  for (const [category, terms] of Object.entries(CATEGORY_SEARCH_TERMS) as [
    BangladeshTeamCategory,
    string[],
  ][]) {
    for (const term of terms) {
      const { rows: seriesRows, warning } = await searchCricApiSeries(term);
      if (warning) warnings.push(warning);

      for (const series of seriesRows) {
        const seriesId = series.id ? String(series.id) : "";
        if (!seriesId) continue;

        const startDate = series.startDate ? String(series.startDate) : undefined;
        const endDate = series.endDate ? String(series.endDate) : undefined;
        if (!isRelevantSeriesWindow({ startDate, endDate })) continue;

        const { matches } = await fetchSeriesInfo(seriesId).catch(() => ({
          matches: [] as LiveMatchSummary[],
          squads: [],
        }));

        for (const match of matches) {
          const raw = toRawMatch(match);
          if (!raw || byMatchId.has(`cricapi-${raw.id}`)) continue;
          byMatchId.set(
            `cricapi-${raw.id}`,
            mapCricApiMatchToUpsertRow(
              raw,
              category,
              { id: seriesId, name: series.name ? String(series.name) : undefined },
              isBangladeshTeam,
            ),
          );
        }
      }
    }
  }

  // Broader net: CricAPI's own live/recent/upcoming lists can carry a Bangladesh fixture whose
  // series name search missed (renamed tournaments, tri-series, associate events) -- text
  // classification decides the category here since there's no search-term context.
  const current = await fetchCurrentMatches().catch(() => []);
  const listed = await fetchMatchesList(2).catch(() => []);
  for (const match of [...current, ...listed]) {
    if (!match.id || byMatchId.has(`cricapi-${match.id}`)) continue;
    const teams = match.teams ?? match.teamInfo?.map((t) => t.name) ?? [];
    if (!teams.some((t) => isBangladeshTeam(t))) continue;

    const raw = toRawMatch(match);
    if (!raw) continue;
    byMatchId.set(
      `cricapi-${raw.id}`,
      mapCricApiMatchToUpsertRow(raw, "men", {}, isBangladeshTeam),
    );
  }

  const rows = [...byMatchId.values()];
  await upsertBangladeshMatches(rows);

  return { upserted: rows.length, warnings: [...new Set(warnings)] };
}
