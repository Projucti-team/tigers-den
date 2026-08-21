import { fetchLeagueEventRefs } from "@/lib/cricket/providers/espn-league-events";
import { buildBangladeshScheduleRow, trackedLeagues } from "@/lib/cricket/providers/espn-live";
import {
  upsertBangladeshMatches,
  type BangladeshMatchUpsert,
} from "@/lib/cricket/services/bangladesh-matches-db";

/**
 * Refreshes bangladesh_matches for every Bangladesh representative side (men, women, u19,
 * emerging) from ESPNcricinfo's Core API -- CricAPI was dropped as the source for this job.
 * CricAPI's series-search + series_info endpoints repeatedly proved unreliable for this exact
 * use case (year-less dates that mis-parsed as 25-years-stale, and a real, currently-running
 * series -- "Bangladesh tour of Australia, 2026" -- whose series_info returned zero matches
 * despite the series clearly being live), while ESPN already powers the Tours page and the
 * Match Centre's live/recent/upcoming scans correctly for the same data. This job reuses that
 * exact same league-discovery (trackedLeagues(), fed by squads, admin fixture overrides, and
 * tour_sync_state — the same source /tours already trusts) rather than inventing a second,
 * CricAPI-based discovery path.
 */
export async function syncBangladeshMatches(): Promise<{
  upserted: number;
  warnings: string[];
}> {
  const warnings: string[] = [];

  const leagues = (await trackedLeagues()).filter((league) => league.kind !== "domestic");
  if (!leagues.length) {
    warnings.push("No ESPN leagues discovered yet for Bangladesh's national teams.");
    return { upserted: 0, warnings };
  }

  const leagueEventRefs = await Promise.all(
    leagues.map(async (league) => ({ league, refs: await fetchLeagueEventRefs(league) })),
  );

  const seen = new Set<string>();
  const byMatchId = new Map<string, BangladeshMatchUpsert>();

  for (const { league, refs } of leagueEventRefs) {
    for (const { eventId } of refs) {
      const matchId = `espn-${eventId}`;
      if (seen.has(matchId)) continue;
      seen.add(matchId);

      const row = await buildBangladeshScheduleRow(league, eventId).catch(() => null);
      if (!row) continue;

      byMatchId.set(matchId, {
        match_id: matchId,
        team_category: row.category,
        match_type: row.matchType,
        status: row.status,
        status_text: row.statusText,
        teams: row.teams.length ? row.teams : null,
        opponent: row.opponent,
        score_summary: row.scoreSummary,
        venue: row.venue,
        match_date: row.matchDate,
        series_id: row.seriesId,
        series_name: row.seriesName,
        espn_league_id: row.espnLeagueId,
        espn_event_id: row.espnEventId,
        source: "espn",
      });
    }
  }

  const rows = [...byMatchId.values()];
  await upsertBangladeshMatches(rows);

  return { upserted: rows.length, warnings: [...new Set(warnings)] };
}
