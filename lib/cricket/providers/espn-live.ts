import { readFile } from "node:fs/promises";
import path from "node:path";

import { isBangladeshTeam } from "@/lib/cricket/constants";
import {
  matchCategoryFromText,
  matchCategoryPriority,
} from "@/lib/cricket/match-category";
import { compactCricketScore } from "@/lib/cricket/score-format";
import {
  fetchEventTimestamp,
  fetchLeagueEventRefs,
} from "@/lib/cricket/providers/espn-league-events";
import { teamShortCode } from "@/lib/cricket/services/marquee-format";
import type { MatchHighlight } from "@/lib/cricket/services/match-highlight";
import { readEspnTourSquads } from "@/lib/cricket/squads/store";
import {
  getTrackedPlayerLeagueEntries,
  teamNameMatches,
  trackedPlayerLeaguesToRefs,
  type TrackedLeagueRef,
} from "@/lib/cricket/tracked-player-leagues";
import { filterMatchesForTour } from "@/lib/cricket/tour-identity";
import type { LiveMatchSummary, Tour } from "@/lib/cricket/types";

const CORE_BASE = "http://core.espnuk.org/v2/sports/cricket";
const FIXTURE_TIMES_PATH = path.join(process.cwd(), "data", "espn-fixture-times.json");

const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const LIVE_CACHE_MS = 45_000;
const RECENT_CACHE_MS = 45_000;

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

async function fetchCoreJson<T>(url: string): Promise<T | null> {
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
}

async function fetchCoreList(url: string): Promise<CoreList> {
  return (await fetchCoreJson<CoreList>(url)) ?? { items: [] };
}

function eventIdFromRef(ref: string): string | null {
  return ref.split("/events/")[1]?.split("/")[0] ?? null;
}

async function trackedLeagues(): Promise<LeagueRef[]> {
  const byId = new Map<number, LeagueRef>();

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

  try {
    const raw = await readFile(FIXTURE_TIMES_PATH, "utf8");
    const data = JSON.parse(raw) as {
      series?: Record<
        string,
        {
          tourName?: string;
          espnLeagueId?: number;
          cricinfoSeriesId?: number;
          seasonYear?: number;
          useSeasonEvents?: boolean;
        }
      >;
    };
    for (const series of Object.values(data.series ?? {})) {
      if (series.espnLeagueId) {
        byId.set(series.espnLeagueId, {
          espnLeagueId: series.espnLeagueId,
          cricinfoSeriesId: series.cricinfoSeriesId,
          seasonYear: series.seasonYear,
          useSeasonEvents: series.useSeasonEvents !== false,
          tourName: series.tourName,
          kind: "international",
        });
      }
    }
  } catch {
    // optional file
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

async function fetchCompetitorScore(
  compRef: string,
): Promise<{ team: string; score: string } | null> {
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

  return { team: label, score: scoreText };
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
  ).filter((row): row is { team: string; score: string } => Boolean(row));

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
    const trackedTeam = league.trackedTeamName?.trim();
    if (!trackedTeam || !rows.some((row) => teamNameMatches(row.team, trackedTeam))) {
      return null;
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
  ).filter((row): row is { team: string; score: string } => Boolean(row));

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
  if (/^\d+$/.test(tour.id) && String(league.cricinfoSeriesId) !== tour.id) {
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

  const matches: LiveMatchSummary[] = [];
  for (const { eventId, leagueId } of eventRefs) {
    const match = await buildLiveMatchFromEspnEvent(leagueId, eventId, "any");
    if (!match) continue;
    matches.push({
      ...match,
      seriesId: tour.id,
      seriesName: tour.name,
    });
  }

  return filterMatchesForTour(
    tour,
    matches.sort((a, b) => {
      const ta = a.dateTimeGMT ? new Date(a.dateTimeGMT).getTime() : 0;
      const tb = b.dateTimeGMT ? new Date(b.dateTimeGMT).getTime() : 0;
      return ta - tb;
    }),
  );
}

async function scanEspnBangladeshMatches(
  mode: "live" | "completed" | "upcoming",
): Promise<{ match: LiveMatchSummary; eventAt: number }[]> {
  const leagues = (await trackedLeagues()).filter((league) => league.kind !== "domestic");
  const candidates: { match: LiveMatchSummary; eventAt: number }[] = [];
  const seenEvents = new Set<string>();

  for (const league of leagues) {
    const eventRefs = await fetchLeagueEventRefs(league);
    for (const { eventId } of eventRefs) {
      if (seenEvents.has(eventId)) continue;
      seenEvents.add(eventId);

      const match = await buildLiveMatchFromEspnEvent(league.espnLeagueId, eventId, mode);
      if (!match) continue;

      const eventAt = await fetchEventTimestamp(league.espnLeagueId, eventId);
      candidates.push({ match, eventAt });
    }
  }

  return candidates;
}

async function scanEspnBangladeshHighlights(
  mode: "live" | "completed",
  options?: { internationalOnly?: boolean },
): Promise<{ highlight: MatchHighlight; eventAt: number }[]> {
  const leagues = await trackedLeagues();
  const scoped = options?.internationalOnly
    ? leagues.filter((league) => league.kind !== "domestic")
    : leagues;
  const candidates: { highlight: MatchHighlight; eventAt: number }[] = [];
  const seenEvents = new Set<string>();

  for (const league of scoped) {
    const eventRefs = await fetchLeagueEventRefs(league);
    for (const { eventId } of eventRefs) {
      if (seenEvents.has(eventId)) continue;
      seenEvents.add(eventId);

      const highlight = await buildHighlightFromEspnEvent(league, eventId, mode);
      if (!highlight) continue;

      const eventAt = await fetchEventTimestamp(league.espnLeagueId, eventId);
      candidates.push({ highlight, eventAt });
    }
  }

  return candidates;
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
