import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { isBangladeshTeam } from "@/lib/cricket/constants";
import {
  matchCategoryFromText,
  matchCategoryPriority,
  type MatchCategory,
} from "@/lib/cricket/match-category";
import { compactCricketScore } from "@/lib/cricket/score-format";
import {
  fetchEventTimestamp,
  fetchLeagueEventRefs,
} from "@/lib/cricket/providers/espn-league-events";
import { fetchEspnTeamInfo } from "@/lib/cricket/providers/espn-athletes-teams";
import { resolveEspnLeagueByCricinfoId } from "@/lib/cricket/providers/espn-squads";
import { teamShortCode } from "@/lib/cricket/services/marquee-format";
import type { MatchHighlight } from "@/lib/cricket/services/match-highlight";
import { readEspnTourSquads } from "@/lib/cricket/squads/store";
import { readTourSyncStatesWithEspnLeague } from "@/lib/cricket/services/tour-sync-state-db";
import {
  getTrackedPlayerLeagueEntries,
  teamNameMatches,
  trackedPlayerLeaguesToRefs,
  type TrackedLeagueRef,
} from "@/lib/cricket/tracked-player-leagues";
import { filterMatchesForTour, isUmbrellaTourName } from "@/lib/cricket/tour-identity";
import type { LiveMatchSummary, Tour } from "@/lib/cricket/types";
import { isPostgresDatabase } from "@/lib/payload-postgres-url";

const CORE_BASE = "http://core.espnuk.org/v2/sports/cricket";
const FIXTURE_TIMES_PATH = path.join(process.cwd(), "data", "espn-fixture-times.json");

const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const LIVE_CACHE_MS = 90_000;
const RECENT_CACHE_MS = 90_000;

type CoreList = { items?: { $ref: string }[] };

type CoreCompetition = {
  id?: string;
  date?: string;
  liveAvailable?: boolean;
  note?: string;
  description?: string;
  shortDescription?: string;
  status?: { $ref: string };
  venue?: {
    fullName?: string;
    address?: { city?: string; country?: string };
  };
};

type CoreStatus = {
  type?: { state?: string; description?: string; detail?: string };
  summary?: string;
  longSummary?: string;
};

type CoreScore = {
  value?: string;
  displayValue?: string;
  innings?: string;
};

type CoreTeam = {
  displayName?: string;
  abbreviation?: string;
};

type LeagueRef = TrackedLeagueRef;

let liveCache: { at: number; highlights: MatchHighlight[] } | null = null;
let recentCache: { at: number; highlight: MatchHighlight | null } | null = null;

const CORE_JSON_CACHE_MS = 20_000;
// The "live" and "recent" scans (and match-centre's own per-event fetch) can request the same
// event's competition/status/competitors within one page render -- dedupe + short-cache here too.
const coreJsonCache = new Map<string, { at: number; promise: Promise<unknown> }>();

async function fetchCoreJson<T>(url: string): Promise<T | null> {
  const cached = coreJsonCache.get(url);
  if (cached && Date.now() - cached.at < CORE_JSON_CACHE_MS) {
    return cached.promise as Promise<T | null>;
  }

  const promise = (async () => {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": BROWSER_USER_AGENT },
        signal: AbortSignal.timeout(18_000),
        cache: "no-store",
      });
      if (!res.ok) return null;
      return (await res.json()) as T;
    } catch {
      return null;
    }
  })();

  coreJsonCache.set(url, { at: Date.now(), promise });
  return promise as Promise<T | null>;
}

async function fetchCoreList(url: string): Promise<CoreList> {
  return (await fetchCoreJson<CoreList>(url)) ?? { items: [] };
}

function eventIdFromRef(ref: string): string | null {
  return ref.split("/events/")[1]?.split("/")[0] ?? null;
}

// Auto-resolving a missing/unresolved espnLeagueId can fall back to scanning ESPN's full
// leagues list (up to ~1500 requests — see resolveEspnLeagueByCricinfoId). trackedLeagues() is
// on live-match/marquee hot paths, so cap resolution attempts per series regardless of how many
// times it's called; a successful resolve gets persisted to disk so it never retries again.
const RESOLVE_COOLDOWN_MS = 60 * 60 * 1000;
const resolveAttemptedAt = new Map<number, number>();

type FixtureTimesFile = {
  fetchedAt?: string;
  series?: Record<
    string,
    {
      tourName?: string;
      espnLeagueId?: number;
      cricinfoSeriesId?: number;
      seasonYear?: number;
      useSeasonEvents?: boolean;
      fixtures?: unknown;
    }
  >;
};

/**
 * Leagues from data/espn-fixture-times.json. An entry with no espnLeagueId, or with
 * espnLeagueId seeded equal to cricinfoSeriesId (the "unresolved" sentinel — same convention
 * normalizeLeagueRef uses for admin-pinned overrides in espn-squads.ts), gets auto-resolved
 * against ESPN's Core API and the result persisted back to the file so future reads are direct.
 * This lets a tournament (e.g. an ICC World Cup) be tracked by cricinfoSeriesId alone, without
 * anyone having to manually look up ESPN's internal league id.
 */
async function fixtureTimesLeagues(): Promise<LeagueRef[]> {
  let raw: string;
  try {
    raw = await readFile(FIXTURE_TIMES_PATH, "utf8");
  } catch {
    return [];
  }

  let data: FixtureTimesFile;
  try {
    data = JSON.parse(raw) as FixtureTimesFile;
  } catch {
    return [];
  }

  const refs: LeagueRef[] = [];
  let changed = false;

  for (const series of Object.values(data.series ?? {})) {
    const cricinfoSeriesId = series.cricinfoSeriesId;
    let espnLeagueId = series.espnLeagueId;
    const unresolved = !espnLeagueId || espnLeagueId === cricinfoSeriesId;

    if (unresolved && cricinfoSeriesId) {
      const lastAttempt = resolveAttemptedAt.get(cricinfoSeriesId) ?? 0;
      if (Date.now() - lastAttempt > RESOLVE_COOLDOWN_MS) {
        resolveAttemptedAt.set(cricinfoSeriesId, Date.now());
        const resolved = await resolveEspnLeagueByCricinfoId(cricinfoSeriesId).catch(() => null);
        if (resolved && resolved !== espnLeagueId) {
          espnLeagueId = resolved;
          series.espnLeagueId = resolved;
          changed = true;
        }
      }
      // Not yet resolved (or resolution failed/cooling down) — fall back to the sentinel so
      // the series is still attempted rather than silently dropped from every scan.
      espnLeagueId = espnLeagueId || cricinfoSeriesId;
    }

    if (!espnLeagueId) continue;
    refs.push({
      espnLeagueId,
      cricinfoSeriesId,
      seasonYear: series.seasonYear,
      useSeasonEvents: series.useSeasonEvents !== false,
      tourName: series.tourName,
      kind: "international",
    });
  }

  if (changed) {
    try {
      await writeFile(FIXTURE_TIMES_PATH, `${JSON.stringify(data, null, 2)}\n`, "utf8");
    } catch {
      // Best-effort persistence (e.g. read-only filesystem) — resolution still succeeded
      // in-memory for this run.
    }
  }

  return refs;
}

/**
 * Tours the squad-refresh pipeline has already resolved against ESPN (tour_sync_state.espn_league_id,
 * set via recordResolvedTourSeries()) — populated automatically for every Bangladesh tour the site
 * tracks, unlike espn-fixture-times.json and espn-tour-squads.json, which both require someone to
 * hand-add a new series before the live/completed/upcoming ESPN scans below know it exists. A tour
 * that starts (or finishes) without anyone updating those curated files used to leave the marquee
 * stuck on the previous tour's result and an empty upcoming list, even though CricAPI's own tours
 * feed already knew about it.
 */
async function tourSyncStateLeagues(): Promise<LeagueRef[]> {
  if (!isPostgresDatabase()) return [];
  try {
    const states = await readTourSyncStatesWithEspnLeague();
    const refs: LeagueRef[] = [];
    for (const state of states) {
      if (!state.espn_league_id) continue;
      refs.push({
        espnLeagueId: state.espn_league_id,
        cricinfoSeriesId: state.espn_cricinfo_series_id ?? undefined,
        seasonYear: new Date(state.updated_at).getFullYear(),
        useSeasonEvents: true,
        tourName: state.tour_slug,
        kind: "international",
      });
    }
    return refs;
  } catch {
    return [];
  }
}

/** Exported so the DB-backed Bangladesh schedule sync (sync-bangladesh-matches.ts) can drive
 * its own event scan off the exact same auto-discovered league set as the live/recent/upcoming
 * scans below, instead of a separate CricAPI-based discovery path that turned out to have real
 * data gaps (CricAPI's series_info endpoint returning zero matches for a real, currently-running
 * series). This is the list /tours and the marquee already depend on. */
export /**
 * ESPN Core team ids for Bangladesh's four representative sides — confirmed live against ESPN's
 * team search (site.api.espn.com/apis/search/v2): men=25, women=299037, u19=672, emerging/A=668.
 * Kept here rather than in countries-seed.ts (which only tracks senior teams for every country)
 * since these extra three ids are specific to Bangladesh's own age-group/A sides.
 */
const BANGLADESH_TEAM_IDS: Record<"men" | "women" | "u19" | "emerging", number> = {
  men: 25,
  women: 299037,
  u19: 672,
  emerging: 668,
};

/**
 * Every Bangladesh side's own current-event/default league, resolved straight from ESPN's team
 * object (the same `event`/`defaultLeague` refs sync-tracked-domestic-players.ts already trusts
 * for county sides) -- a baseline that doesn't depend on any other pipeline (squad refresh,
 * tour_sync_state, curated fixture-times.json) having already discovered the series first. This
 * closes the exact gap that made a real, currently-live series ("Bangladesh tour of Australia
 * 2026", ESPN league 24231) invisible to every scan below until the squad-refresh job happened
 * to resolve it separately -- confirmed live: teams/25's `event` ref already points straight at
 * league 24231's next match, no other pipeline required.
 */
async function bangladeshTeamLeagues(): Promise<LeagueRef[]> {
  const refs: LeagueRef[] = [];
  await Promise.all(
    Object.values(BANGLADESH_TEAM_IDS).map(async (teamId) => {
      const info = await fetchEspnTeamInfo(teamId).catch(() => null);
      if (!info) return;
      for (const leagueId of [info.currentEventLeagueId, info.defaultLeagueId]) {
        if (!leagueId) continue;
        refs.push({ espnLeagueId: leagueId, kind: "international" });
      }
    }),
  );
  return refs;
}

/** Exported so the DB-backed Bangladesh schedule sync (sync-bangladesh-matches.ts) can drive its
 * own event scan off the exact same auto-discovered league set the live/recent/upcoming scans
 * below already use, instead of a separate CricAPI-based discovery path. */
export async function trackedLeagues(): Promise<LeagueRef[]> {
  const byId = new Map<number, LeagueRef>();

  // Baseline first -- richer sources below (squads, curated fixture times, tour_sync_state) fill
  // in tourName/seasonYear/cricinfoSeriesId for the same league id when they know about it too.
  for (const ref of await bangladeshTeamLeagues()) {
    byId.set(ref.espnLeagueId, ref);
  }

  const squads = await readEspnTourSquads();
  for (const entry of Object.values(squads.entries)) {
    if (entry.espnLeagueId) {
      byId.set(entry.espnLeagueId, {
        espnLeagueId: entry.espnLeagueId,
        cricinfoSeriesId: entry.cricinfoSeriesId,
        kind: "international",
        tourName: entry.tourName,
      });
    }
  }

  for (const ref of await fixtureTimesLeagues()) {
    byId.set(ref.espnLeagueId, ref);
  }

  for (const ref of await tourSyncStateLeagues()) {
    byId.set(ref.espnLeagueId, ref);
  }

  const playerEntries = await getTrackedPlayerLeagueEntries();
  for (const ref of trackedPlayerLeaguesToRefs(playerEntries)) {
    byId.set(ref.espnLeagueId, ref);
  }

  if (!byId.size) {
    byId.set(24324, {
      espnLeagueId: 24324,
      cricinfoSeriesId: 1532475,
      kind: "international",
    });
  }

  return [...byId.values()];
}

function isLiveStatus(status: CoreStatus | null, competition: CoreCompetition): boolean {
  const state = status?.type?.state?.toLowerCase();
  const detail = status?.type?.description?.toLowerCase() ?? "";
  if (state === "in" || detail === "live") return true;
  if (competition.liveAvailable && state !== "post" && state !== "pre") {
    const note = competition.note ?? status?.longSummary ?? "";
    if (/overs remaining|require.*runs|in progress|stumps|lunch|tea/i.test(note)) {
      return true;
    }
  }
  return false;
}

function isCompletedStatus(status: CoreStatus | null, competition: CoreCompetition): boolean {
  if (isLiveStatus(status, competition)) return false;

  const state = status?.type?.state?.toLowerCase();
  if (state === "post") return true;

  const blob = [
    status?.longSummary,
    status?.summary,
    status?.type?.detail,
    competition.note,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/not started|upcoming|scheduled|match starts/i.test(blob)) return false;
  return /won|beat|defeat|tied|draw|no result|abandon|completed|finished|margin/i.test(blob);
}

function isUpcomingStatus(status: CoreStatus | null, competition: CoreCompetition): boolean {
  if (isLiveStatus(status, competition) || isCompletedStatus(status, competition)) {
    return false;
  }

  const state = status?.type?.state?.toLowerCase();
  if (state === "pre" || state === "scheduled") return true;

  const blob = [
    status?.longSummary,
    status?.summary,
    status?.type?.detail,
    competition.note,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return /not started|upcoming|scheduled|match starts|fixture/i.test(blob);
}

/** Compact live match row for dashboard/API consumers. */
export function liveMatchSummaryFromHighlight(highlight: MatchHighlight): LiveMatchSummary {
  return {
    id: highlight.matchId,
    name: highlight.title,
    status: highlight.detailLine,
    venue: highlight.venue?.name,
    isLive: highlight.mode === "live",
    teams: highlight.scores.map((row) => row.label).filter(Boolean),
    score: highlight.scores.map((row, index) => {
      const runsWickets = row.value.match(/^(\d+)\/(\d+)/);
      const overs = row.value.match(/\(([\d.]+)\s*ov\)/);
      return {
        inning: row.label || `Innings ${index + 1}`,
        r: runsWickets ? Number(runsWickets[1]) : 0,
        w: runsWickets ? Number(runsWickets[2]) : 0,
        o: overs ? Number(overs[1]) : 0,
      };
    }),
  };
}

type CompetitorRow = { team: string; score: string; teamId: number | null; competitorRef: string };

function teamIdFromRef(ref: string | undefined): number | null {
  const match = ref?.match(/\/teams\/(\d+)/);
  const id = match ? Number(match[1]) : NaN;
  return Number.isFinite(id) ? id : null;
}

async function fetchCompetitorScore(compRef: string): Promise<CompetitorRow | null> {
  const comp = await fetchCoreJson<{
    team?: { $ref: string };
    score?: { $ref: string };
  }>(compRef);
  if (!comp?.team?.$ref) return null;

  const team = await fetchCoreJson<CoreTeam>(comp.team.$ref);
  const label = team?.displayName ?? team?.abbreviation ?? "Team";

  let scoreText = "";
  if (comp.score?.$ref) {
    const score = await fetchCoreJson<CoreScore>(comp.score.$ref);
    scoreText = score?.displayValue ?? score?.value ?? "";
  }

  return { team: label, score: scoreText, teamId: teamIdFromRef(comp.team.$ref), competitorRef: compRef };
}

/** True when the tracked athlete is actually named in this competitor's roster (playing XI). */
async function isAthleteInCompetitorRoster(
  competitorRef: string,
  athleteId: number,
): Promise<boolean> {
  const roster = await fetchCoreJson<{ entries?: { playerId?: number }[] }>(
    `${competitorRef}/roster`,
  );
  return (roster?.entries ?? []).some((entry) => Number(entry.playerId) === athleteId);
}

/** Team-id match when we have it (reliable — resolved directly from the team's cricinfo link), else name fallback. */
function domesticTeamMatches(
  row: { team: string; teamId: number | null },
  league: LeagueRef,
): boolean {
  if (league.trackedTeamId && row.teamId) return row.teamId === league.trackedTeamId;
  return Boolean(league.trackedTeamName) && teamNameMatches(row.team, league.trackedTeamName!);
}

async function buildHighlightFromEspnEvent(
  league: LeagueRef,
  eventId: string,
  mode: "live" | "completed",
): Promise<MatchHighlight | null> {
  const leagueId = league.espnLeagueId;
  const competition = await fetchCoreJson<CoreCompetition>(
    `${CORE_BASE}/leagues/${leagueId}/events/${eventId}/competitions/${eventId}`,
  );
  if (!competition) return null;

  const status = competition.status?.$ref
    ? await fetchCoreJson<CoreStatus>(competition.status.$ref)
    : null;

  if (mode === "live") {
    if (!isLiveStatus(status, competition)) return null;
  } else if (!isCompletedStatus(status, competition)) {
    return null;
  }

  const competitors = await fetchCoreList(
    `${CORE_BASE}/leagues/${leagueId}/events/${eventId}/competitions/${eventId}/competitors`,
  );

  // Keep every competitor with a team name — a side that hasn't batted yet
  // (toss, rain delay, opponent's first innings) simply has an empty score.
  const rows = (
    await Promise.all(
      (competitors.items ?? []).map((item) => fetchCompetitorScore(item.$ref)),
    )
  ).filter((row): row is CompetitorRow => Boolean(row));

  const innings = rows.filter((row) => row.score);

  const event = await fetchCoreJson<{ name?: string; shortName?: string }>(
    `${CORE_BASE}/leagues/${leagueId}/events/${eventId}`,
  );
  const titleBlob = [
    competition.shortDescription,
    competition.description,
    event?.name,
    event?.shortName,
    competition.note,
    ...rows.map((r) => r.team),
  ]
    .filter(Boolean)
    .join(" ");

  if (league.kind === "domestic") {
    const trackedRow = rows.find((row) => domesticTeamMatches(row, league));
    if (!trackedRow) return null;

    // The team is playing, but is the tracked player actually in the XI? A live/completed
    // roster is set once the match starts, so verify it here rather than trusting "their team
    // is playing" -- e.g. Kent have a live match but the specific tracked player was left out.
    if (league.trackedAthleteId) {
      const inRoster = await isAthleteInCompetitorRoster(
        trackedRow.competitorRef,
        league.trackedAthleteId,
      ).catch(() => true); // ESPN roster hiccup shouldn't silently hide a real match — fail open
      if (!inRoster) return null;
    }
  } else {
    let involvesBd =
      rows.some((row) => isBangladeshTeam(row.team)) ||
      /bangladesh/i.test(competition.note ?? "");

    if (!involvesBd) {
      const blob = `${event?.name ?? ""} ${event?.shortName ?? ""}`.toLowerCase();
      involvesBd = blob.includes("bangladesh") || /\bban\b/.test(blob);
    }
    if (!involvesBd) return null;
  }

  const scores = innings.map((inn) => {
    const chasing =
      /\d+\s*ov|target\s+\d+/i.test(inn.score) && !/^\d+\/\d+$/.test(inn.score.trim());
    return {
      label: inn.team,
      value: compactCricketScore(inn.score, !chasing),
    };
  });

  const bdScore = scores.find((s) => isBangladeshTeam(s.label));
  const otherScore = scores.find((s) => !isBangladeshTeam(s.label));
  const scoreLine =
    bdScore && otherScore
      ? `${teamShortCode(bdScore.label)} ${bdScore.value} · ${teamShortCode(otherScore.label)} ${otherScore.value}`
      : scores.length
        ? scores.map((s) => `${teamShortCode(s.label)} ${s.value}`).join(" · ")
        : // No ball bowled yet (toss / rain delay) — fall back to team names.
          rows.map((row) => teamShortCode(row.team)).join(" vs ");

  const title =
    competition.shortDescription?.trim() ||
    competition.description?.trim() ||
    `Bangladesh match · Event ${eventId}`;

  const baseDetail =
    status?.longSummary ??
    status?.summary ??
    competition.note ??
    (mode === "live" ? "Live on ESPNcricinfo" : "Result on ESPNcricinfo");

  // During interruptions ESPN puts the real state in type.description
  // (e.g. "Match delayed by rain", "Rain stopped play") while the summary
  // still shows the toss — surface it when it's more than a generic "Live".
  const interruption = status?.type?.description?.trim() ?? "";
  const detailLine =
    mode === "live" &&
    interruption &&
    !/^(live|in progress|scheduled|current)$/i.test(interruption) &&
    interruption.toLowerCase() !== baseDetail.toLowerCase()
      ? `${interruption} · ${baseDetail}`
      : baseDetail;

  const venue = competition.venue
    ? {
        name: competition.venue.fullName,
        city: competition.venue.address?.city,
        country: competition.venue.address?.country,
      }
    : undefined;

  const category =
    league.kind === "domestic"
      ? "domestic"
      : matchCategoryFromText(title, titleBlob, ...rows.map((r) => r.team));
  const priority = matchCategoryPriority(category);

  return {
    mode,
    matchId: `espn-${eventId}`,
    title,
    scoreLine,
    detailLine,
    scores,
    venue,
    category,
    priority,
    espnLeagueId: leagueId,
    bannerTitle:
      league.kind === "domestic" && league.trackedPlayerName && league.trackedTeamName
        ? `${league.trackedPlayerName} is playing for ${league.trackedTeamName}`
        : undefined,
    leagueLabel: league.leagueDisplayName ?? league.tourName,
  };
}

export type BangladeshScheduleEventRow = {
  espnEventId: string;
  espnLeagueId: number;
  category: MatchCategory;
  status: "live" | "completed" | "upcoming";
  statusText: string;
  matchType: string | null;
  teams: string[];
  opponent: string | null;
  scoreSummary: string | null;
  venue: string | null;
  matchDate: string | null;
  seriesId: string | null;
  seriesName: string | null;
};

/**
 * One row per ESPN event, shaped for the DB-backed bangladesh_matches table -- sibling to
 * buildHighlightFromEspnEvent (which builds a UI-ready MatchHighlight for live/completed only)
 * and buildLiveMatchFromEspnEvent (LiveMatchSummary, no category). This is the single function
 * used by sync-bangladesh-matches.ts to persist last-result/live/upcoming rows for every
 * Bangladesh representative side (men/women/u19/emerging) straight from ESPNcricinfo's Core API,
 * with no CricAPI involvement.
 */
export async function buildBangladeshScheduleRow(
  league: LeagueRef,
  eventId: string,
): Promise<BangladeshScheduleEventRow | null> {
  const leagueId = league.espnLeagueId;
  const competition = await fetchCoreJson<CoreCompetition>(
    `${CORE_BASE}/leagues/${leagueId}/events/${eventId}/competitions/${eventId}`,
  );
  if (!competition) return null;

  const status = competition.status?.$ref
    ? await fetchCoreJson<CoreStatus>(competition.status.$ref)
    : null;

  const live = isLiveStatus(status, competition);
  const completed = !live && isCompletedStatus(status, competition);

  const competitors = await fetchCoreList(
    `${CORE_BASE}/leagues/${leagueId}/events/${eventId}/competitions/${eventId}/competitors`,
  );
  const rows = (
    await Promise.all((competitors.items ?? []).map((item) => fetchCompetitorScore(item.$ref)))
  ).filter((row): row is CompetitorRow => Boolean(row));

  const event = await fetchCoreJson<{ name?: string; shortName?: string; date?: string }>(
    `${CORE_BASE}/leagues/${leagueId}/events/${eventId}`,
  );

  let involvesBd =
    rows.some((row) => isBangladeshTeam(row.team)) || /bangladesh/i.test(competition.note ?? "");
  if (!involvesBd) {
    const blob = `${event?.name ?? ""} ${event?.shortName ?? ""}`.toLowerCase();
    involvesBd = blob.includes("bangladesh") || /\bban\b/.test(blob);
  }
  if (!involvesBd) return null;

  const teams = rows.map((row) => row.team).filter(Boolean);
  const opponent = teams.find((t) => !isBangladeshTeam(t)) ?? null;

  const titleBlob = [
    competition.shortDescription,
    competition.description,
    event?.name,
    event?.shortName,
    competition.note,
    ...teams,
  ]
    .filter(Boolean)
    .join(" ");
  // matchCategoryFromText never actually returns "domestic" (that value only comes from
  // league.kind elsewhere) — safe to narrow here since this function is only ever called for
  // international (non-domestic) leagues.
  const category = matchCategoryFromText(titleBlob) as MatchCategory;

  const innings = rows.filter((row) => row.score);
  const scoreSummary = innings.length
    ? innings.map((row) => `${row.team}: ${compactCricketScore(row.score, true)}`).join(" · ")
    : null;

  const eventAt = await fetchEventTimestamp(leagueId, eventId);
  const iso =
    competition.date ??
    event?.date ??
    (eventAt > 0 ? new Date(eventAt).toISOString() : undefined);

  const statusText =
    status?.longSummary ??
    status?.summary ??
    competition.note ??
    (live ? "Live" : completed ? "Completed" : "Match not started");

  let matchType: string | null = null;
  if (/t20/i.test(titleBlob)) matchType = "t20";
  else if (/odi|one-day/i.test(titleBlob)) matchType = "odi";
  else if (/test/i.test(titleBlob)) matchType = "test";

  return {
    espnEventId: eventId,
    espnLeagueId: leagueId,
    category,
    status: live ? "live" : completed ? "completed" : "upcoming",
    statusText,
    matchType,
    teams,
    opponent,
    scoreSummary,
    venue: competition.venue?.fullName ?? null,
    matchDate: iso ?? null,
    seriesId: league.cricinfoSeriesId ? String(league.cricinfoSeriesId) : null,
    seriesName: league.tourName ?? null,
  };
}

async function buildLiveMatchFromEspnEvent(
  leagueId: number,
  eventId: string,
  mode: "live" | "completed" | "upcoming" | "any",
): Promise<LiveMatchSummary | null> {
  const competition = await fetchCoreJson<CoreCompetition>(
    `${CORE_BASE}/leagues/${leagueId}/events/${eventId}/competitions/${eventId}`,
  );
  if (!competition) return null;

  const status = competition.status?.$ref
    ? await fetchCoreJson<CoreStatus>(competition.status.$ref)
    : null;

  if (mode !== "any") {
    if (mode === "live") {
      if (!isLiveStatus(status, competition)) return null;
    } else if (mode === "completed") {
      if (!isCompletedStatus(status, competition)) return null;
    } else if (!isUpcomingStatus(status, competition)) {
      return null;
    }
  }

  const competitors = await fetchCoreList(
    `${CORE_BASE}/leagues/${leagueId}/events/${eventId}/competitions/${eventId}/competitors`,
  );
  const rows = (
    await Promise.all(
      (competitors.items ?? []).map((item) => fetchCompetitorScore(item.$ref)),
    )
  ).filter((row): row is CompetitorRow => Boolean(row));

  let involvesBd =
    rows.some((row) => isBangladeshTeam(row.team)) ||
    /bangladesh/i.test(competition.note ?? "");

  const event = await fetchCoreJson<{ name?: string; shortName?: string; date?: string }>(
    `${CORE_BASE}/leagues/${leagueId}/events/${eventId}`,
  );

  if (!involvesBd) {
    const blob = `${event?.name ?? ""} ${event?.shortName ?? ""}`.toLowerCase();
    involvesBd = blob.includes("bangladesh") || /\bban\b/.test(blob);
  }
  if (!involvesBd) return null;

  const teams = rows.map((row) => row.team).filter(Boolean);
  const title =
    competition.shortDescription?.trim() ||
    competition.description?.trim() ||
    event?.name?.trim() ||
    `Bangladesh match · Event ${eventId}`;
  const live = isLiveStatus(status, competition);
  const completed = isCompletedStatus(status, competition);
  const statusText =
    status?.longSummary ??
    status?.summary ??
    competition.note ??
    (mode === "upcoming" || (!live && !completed)
      ? "Match not started"
      : live
        ? "Live"
        : "Completed");
  const eventAt = await fetchEventTimestamp(leagueId, eventId);
  const iso =
    competition.date ??
    event?.date ??
    (eventAt > 0 ? new Date(eventAt).toISOString() : undefined);
  const dateTimeGMT = iso
    ? iso.endsWith("Z")
      ? iso.replace(/(\.\d{3})?Z$/, ".000Z")
      : `${iso}Z`
    : undefined;

  const blob = `${title} ${event?.name ?? ""} ${event?.shortName ?? ""}`;
  let matchType: string | undefined;
  if (/t20/i.test(blob)) matchType = "t20";
  else if (/odi|one-day/i.test(blob)) matchType = "odi";
  else if (/test/i.test(blob)) matchType = "test";

  return {
    id: `espn-${eventId}`,
    name: title,
    matchType,
    status: statusText,
    venue: competition.venue?.fullName,
    date: dateTimeGMT?.slice(0, 10),
    dateTimeGMT,
    teams: teams.length ? teams : undefined,
    isLive: mode === "live" || (mode === "any" && live),
  };
}

/**
 * Upcoming-fixture counterpart to buildHighlightFromEspnEvent()'s domestic branch (that one
 * only covers live/completed) — matches against league.trackedTeamName, not Bangladesh, since
 * neither side of a county match is literally "Bangladesh". Deliberately a separate function
 * rather than extending buildLiveMatchFromEspnEvent(), which is also called from
 * buildTourMatchesFromEspnSeries() for real tour fixtures and shouldn't gain domestic-matching
 * behavior it was never designed for.
 */
async function buildUpcomingDomesticMatch(
  league: LeagueRef,
  eventId: string,
): Promise<LiveMatchSummary | null> {
  const leagueId = league.espnLeagueId;
  if (!league.trackedTeamId && !league.trackedTeamName?.trim()) return null;

  const competition = await fetchCoreJson<CoreCompetition>(
    `${CORE_BASE}/leagues/${leagueId}/events/${eventId}/competitions/${eventId}`,
  );
  if (!competition) return null;

  const status = competition.status?.$ref
    ? await fetchCoreJson<CoreStatus>(competition.status.$ref)
    : null;
  if (!isUpcomingStatus(status, competition)) return null;

  const competitors = await fetchCoreList(
    `${CORE_BASE}/leagues/${leagueId}/events/${eventId}/competitions/${eventId}/competitors`,
  );
  const rows = (
    await Promise.all(
      (competitors.items ?? []).map((item) => fetchCompetitorScore(item.$ref)),
    )
  ).filter((row): row is CompetitorRow => Boolean(row));

  // No playing-XI check here -- lineups for domestic matches aren't announced ahead of the toss,
  // so "the tracked player's team is fixtured to play" is the best we can show in advance.
  if (!rows.some((row) => domesticTeamMatches(row, league))) return null;

  const teams = rows.map((row) => row.team).filter(Boolean);
  const event = await fetchCoreJson<{ name?: string; shortName?: string; date?: string }>(
    `${CORE_BASE}/leagues/${leagueId}/events/${eventId}`,
  );
  const title =
    competition.shortDescription?.trim() ||
    competition.description?.trim() ||
    event?.name?.trim() ||
    `${league.trackedTeamName} match`;

  const eventAt = await fetchEventTimestamp(leagueId, eventId);
  const iso =
    competition.date ??
    event?.date ??
    (eventAt > 0 ? new Date(eventAt).toISOString() : undefined);
  const dateTimeGMT = iso
    ? iso.endsWith("Z")
      ? iso.replace(/(\.\d{3})?Z$/, ".000Z")
      : `${iso}Z`
    : undefined;

  const blob = `${title} ${event?.name ?? ""} ${event?.shortName ?? ""}`;
  let matchType: string | undefined;
  if (/t20/i.test(blob)) matchType = "t20";
  else if (/odi|one-day|50-over/i.test(blob)) matchType = "odi";
  else if (/test|championship|4-day|four-day/i.test(blob)) matchType = "test";

  return {
    id: `espn-${eventId}`,
    name: title,
    matchType,
    status: "Match not started",
    venue: competition.venue?.fullName,
    date: dateTimeGMT?.slice(0, 10),
    dateTimeGMT,
    teams: teams.length ? teams : undefined,
    isLive: false,
    trackedPlayerName: league.trackedPlayerName,
    leagueLabel: league.leagueDisplayName,
  };
}

/** Upcoming admin-tracked domestic fixtures (a Bangladeshi player's county/franchise match). */
export async function fetchEspnUpcomingDomesticMatches(limit = 8): Promise<LiveMatchSummary[]> {
  const leagues = (await trackedLeagues()).filter((league) => league.kind === "domestic");
  if (!leagues.length) return [];

  const leagueEventRefs = await Promise.all(
    leagues.map(async (league) => ({ league, refs: await fetchLeagueEventRefs(league) })),
  );

  const seenEvents = new Set<string>();
  const uniqueEvents: { league: LeagueRef; eventId: string }[] = [];
  for (const { league, refs } of leagueEventRefs) {
    for (const { eventId } of refs) {
      if (seenEvents.has(eventId)) continue;
      seenEvents.add(eventId);
      uniqueEvents.push({ league, eventId });
    }
  }

  const built = await Promise.all(
    uniqueEvents.map(async ({ league, eventId }) => {
      const match = await buildUpcomingDomesticMatch(league, eventId);
      if (!match) return null;
      const eventAt = await fetchEventTimestamp(league.espnLeagueId, eventId);
      return { match, eventAt };
    }),
  );

  return built
    .filter((row): row is { match: LiveMatchSummary; eventAt: number } => row !== null)
    .sort((a, b) => a.eventAt - b.eventAt)
    .map((row) => row.match)
    .slice(0, limit);
}

export type EspnTourLeagueRef = {
  espnLeagueId: number;
  cricinfoSeriesId?: number;
  seasonYear?: number;
  useSeasonEvents?: boolean;
};

/** Full fixture list for a tour — results, venues, and upcoming times from ESPN season events. */
export async function buildTourMatchesFromEspnSeries(
  tour: Tour,
  league: EspnTourLeagueRef,
): Promise<LiveMatchSummary[]> {
  if (
    !isUmbrellaTourName(tour.name) &&
    /^\d+$/.test(tour.id) &&
    String(league.cricinfoSeriesId) !== tour.id
  ) {
    console.log(
      `[cricket] buildTourMatchesFromEspnSeries: skipped — "${tour.name}" is not an umbrella tour and league cricinfo=${league.cricinfoSeriesId} != tour.id=${tour.id}`,
    );
    return [];
  }

  const seasonYear =
    league.seasonYear ??
    (tour.startDate ? new Date(tour.startDate).getFullYear() : undefined);

  const eventRefs = await fetchLeagueEventRefs({
    espnLeagueId: league.espnLeagueId,
    cricinfoSeriesId: league.cricinfoSeriesId,
    seasonYear,
    useSeasonEvents: league.useSeasonEvents !== false,
  });
  console.log(
    `[cricket] buildTourMatchesFromEspnSeries: league espn=${league.espnLeagueId} cricinfo=${league.cricinfoSeriesId} seasonYear=${seasonYear} useSeasonEvents=${league.useSeasonEvents !== false} → ${eventRefs.length} event ref(s): [${eventRefs.map((r) => `${r.eventId}@league${r.leagueId}`).join(", ")}]`,
  );

  const matches: LiveMatchSummary[] = [];
  for (const { eventId, leagueId } of eventRefs) {
    const match = await buildLiveMatchFromEspnEvent(leagueId, eventId, "any");
    if (!match) {
      console.log(`[cricket] buildTourMatchesFromEspnSeries: event ${eventId}@league${leagueId} → dropped (buildLiveMatchFromEspnEvent returned null)`);
      continue;
    }
    matches.push({
      ...match,
      seriesId: tour.id,
      seriesName: tour.name,
    });
  }

  const filtered = filterMatchesForTour(
    tour,
    matches.sort((a, b) => {
      const ta = a.dateTimeGMT ? new Date(a.dateTimeGMT).getTime() : 0;
      const tb = b.dateTimeGMT ? new Date(b.dateTimeGMT).getTime() : 0;
      return ta - tb;
    }),
  );
  console.log(
    `[cricket] buildTourMatchesFromEspnSeries: ${matches.length} match(es) built → ${filtered.length} after filterMatchesForTour`,
  );
  return filtered;
}

async function scanEspnBangladeshMatches(
  mode: "live" | "completed" | "upcoming",
): Promise<{ match: LiveMatchSummary; eventAt: number }[]> {
  const leagues = (await trackedLeagues()).filter((league) => league.kind !== "domestic");

  // Every league's event list, then every event's detail fetch, run concurrently instead of
  // one at a time -- this loop used to take 20-40s wall-clock (sequential ESPN round trips
  // across every tracked league) on every cache miss, blocking the response for every visitor
  // regardless of where they were browsing from.
  const leagueEventRefs = await Promise.all(
    leagues.map(async (league) => ({ league, refs: await fetchLeagueEventRefs(league) })),
  );

  const seenEvents = new Set<string>();
  const uniqueEvents: { league: LeagueRef; eventId: string }[] = [];
  for (const { league, refs } of leagueEventRefs) {
    for (const { eventId } of refs) {
      if (seenEvents.has(eventId)) continue;
      seenEvents.add(eventId);
      uniqueEvents.push({ league, eventId });
    }
  }

  const built = await Promise.all(
    uniqueEvents.map(async ({ league, eventId }) => {
      const match = await buildLiveMatchFromEspnEvent(league.espnLeagueId, eventId, mode);
      if (!match) return null;
      const eventAt = await fetchEventTimestamp(league.espnLeagueId, eventId);
      return { match, eventAt };
    }),
  );

  return built.filter((row): row is { match: LiveMatchSummary; eventAt: number } => row !== null);
}

async function scanEspnBangladeshHighlights(
  mode: "live" | "completed",
  options?: { internationalOnly?: boolean; domesticOnly?: boolean },
): Promise<{ highlight: MatchHighlight; eventAt: number }[]> {
  const leagues = await trackedLeagues();
  const scoped = options?.internationalOnly
    ? leagues.filter((league) => league.kind !== "domestic")
    : options?.domesticOnly
      ? leagues.filter((league) => league.kind === "domestic")
      : leagues;

  const leagueEventRefs = await Promise.all(
    scoped.map(async (league) => ({ league, refs: await fetchLeagueEventRefs(league) })),
  );

  const seenEvents = new Set<string>();
  const uniqueEvents: { league: LeagueRef; eventId: string }[] = [];
  for (const { league, refs } of leagueEventRefs) {
    for (const { eventId } of refs) {
      if (seenEvents.has(eventId)) continue;
      seenEvents.add(eventId);
      uniqueEvents.push({ league, eventId });
    }
  }

  const built = await Promise.all(
    uniqueEvents.map(async ({ league, eventId }) => {
      const highlight = await buildHighlightFromEspnEvent(league, eventId, mode);
      if (!highlight) return null;
      const eventAt = await fetchEventTimestamp(league.espnLeagueId, eventId);
      return { highlight, eventAt };
    }),
  );

  return built.filter((row): row is { highlight: MatchHighlight; eventAt: number } => row !== null);
}

/** All live Bangladesh internationals + admin-tracked domestic matches. */
export async function fetchEspnLiveBangladeshHighlights(): Promise<MatchHighlight[]> {
  if (liveCache && Date.now() - liveCache.at < LIVE_CACHE_MS) {
    return liveCache.highlights;
  }

  const candidates = await scanEspnBangladeshHighlights("live");
  const byMatchId = new Map<string, MatchHighlight>();
  for (const row of candidates) {
    byMatchId.set(row.highlight.matchId, row.highlight);
  }
  const highlights = [...byMatchId.values()].sort((a, b) => {
    const pa = a.priority ?? matchCategoryPriority(a.category ?? "men");
    const pb = b.priority ?? matchCategoryPriority(b.category ?? "men");
    if (pa !== pb) return pa - pb;
    return a.title.localeCompare(b.title);
  });

  liveCache = { at: Date.now(), highlights };
  return highlights;
}

/** Live Bangladesh internationals from ESPNcricinfo (no CricAPI quota). */
export async function fetchEspnLiveBangladeshHighlight(): Promise<MatchHighlight | null> {
  const highlights = await fetchEspnLiveBangladeshHighlights();
  return highlights[0] ?? null;
}

/**
 * Live admin-tracked domestic matches only (never a real Bangladesh-team match) -- the DB-backed
 * bangladesh_matches table now covers men/women/u19/emerging directly, but domestic tracked-player
 * fixtures still need this live ESPN scan since there's no pre-announced schedule to sync ahead
 * of time for those. Scoped to just the domestic leagues so it doesn't redo the international scan
 * fetchEspnLiveBangladeshHighlights() already does for the (now DB-backed) national-team matches.
 */
export async function fetchEspnLiveDomesticHighlights(): Promise<MatchHighlight[]> {
  const candidates = await scanEspnBangladeshHighlights("live", { domesticOnly: true });
  const byMatchId = new Map<string, MatchHighlight>();
  for (const row of candidates) {
    byMatchId.set(row.highlight.matchId, row.highlight);
  }
  return [...byMatchId.values()];
}

/** Most recent completed Bangladesh match from ESPN — used when live play has ended. */
export async function fetchEspnRecentBangladeshHighlight(): Promise<MatchHighlight | null> {
  if (recentCache && Date.now() - recentCache.at < RECENT_CACHE_MS) {
    return recentCache.highlight;
  }

  const candidates = await scanEspnBangladeshHighlights("completed", {
    internationalOnly: true,
  });
  const highlight =
    candidates.sort((a, b) => b.eventAt - a.eventAt)[0]?.highlight ?? null;

  recentCache = { at: Date.now(), highlight };
  return highlight;
}

/** Upcoming Bangladesh internationals from ESPNcricinfo league events. */
export async function fetchEspnUpcomingBangladeshMatchesFromEvents(
  limit = 8,
): Promise<LiveMatchSummary[]> {
  const candidates = await scanEspnBangladeshMatches("upcoming");
  return candidates
    .sort((a, b) => a.eventAt - b.eventAt)
    .map((row) => row.match)
    .slice(0, limit);
}
