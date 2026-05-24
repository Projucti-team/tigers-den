import { CRICAPI_BASE } from "@/lib/cricket/constants";
import type { SeriesSquad, SquadPlayer } from "@/lib/cricket/curated-squads";
import { normalizeSquadPlayers } from "@/lib/cricket/curated-squads";
import type { LiveMatchSummary, Scorecard, ScorecardInnings, Tour } from "@/lib/cricket/types";

type CricApiResponse<T> = {
  status: string;
  reason?: string;
  data?: T;
  info?: { totalRows?: number };
};

function getApiKey(): string {
  const key = process.env.CRICKET_DATA_API_KEY;
  if (!key) {
    throw new Error(
      "CRICKET_DATA_API_KEY is not set. Get a free key at https://cricketdata.org/signup.aspx",
    );
  }
  return key;
}

async function cricFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${CRICAPI_BASE}/${path}`);
  url.searchParams.set("apikey", getApiKey());
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), { next: { revalidate: 3600 } });
  if (!res.ok) {
    throw new Error(`CricAPI HTTP ${res.status} for ${path}`);
  }

  const json = (await res.json()) as CricApiResponse<T>;
  if (json.status !== "success" || !json.data) {
    throw new Error(json.reason || `CricAPI failed for ${path}`);
  }

  return json.data;
}

/** CricAPI sometimes returns "Aug 26" without a year — infer from ISO startDate. */
function parseSeriesEndDate(endRaw: string | undefined, startIso: string | undefined): Date | null {
  if (!endRaw) return null;
  const trimmed = endRaw.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const d = new Date(trimmed);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const year = startIso ? new Date(startIso).getFullYear() : new Date().getFullYear();
  const d = new Date(`${trimmed} ${year}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isFutureSeries(startDate?: string, endDate?: string): boolean {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const start = startDate ? new Date(startDate) : null;
  const end = parseSeriesEndDate(endDate, startDate);

  if (start && !Number.isNaN(start.getTime()) && start >= now) return true;
  if (end && end >= now) return true;
  return false;
}

function mapSeriesToTour(s: Record<string, unknown>): Tour {
  const name = String(s.name || "Series");
  const test = Number(s.test) || 0;
  const odi = Number(s.odi) || 0;
  const t20 = Number(s.t20) || 0;
  const matches = Number(s.matches) || test + odi + t20 || 0;

  return {
    id: String(s.id || name),
    name,
    startDate: s.startDate ? String(s.startDate) : undefined,
    endDate: s.endDate ? String(s.endDate) : undefined,
    odi,
    t20,
    test,
    matches,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapLiveMatch(m: any): LiveMatchSummary {
  return {
    id: m.id || m.unique_id || "",
    name: m.name || "",
    matchType: m.matchType,
    status: m.status || "",
    venue: m.venue,
    date: m.date,
    dateTimeGMT: m.dateTimeGMT,
    teams: m.teams,
    teamInfo: m.teamInfo,
    score: m.score,
    isLive: /live|in progress|stumps|innings/i.test(m.status || ""),
  };
}

function parseSquadPlayers(raw: unknown[]): SquadPlayer[] {
  const parsed: (string | SquadPlayer)[] = [];

  for (const p of raw) {
    if (typeof p === "string") {
      if (p) parsed.push(p);
      continue;
    }
    if (p && typeof p === "object") {
      const row = p as Record<string, unknown>;
      const name = String(row.name ?? row.player ?? "");
      if (!name) continue;
      const profileUrl =
        (row.profileUrl as string | undefined) ?? (row.url as string | undefined) ?? null;
      parsed.push(profileUrl ? { name, profileUrl } : { name });
    }
  }

  return normalizeSquadPlayers(parsed);
}

export async function fetchSeriesInfo(seriesId: string): Promise<{
  matches: LiveMatchSummary[];
  squads: SeriesSquad[];
}> {
  const data = await cricFetch<Record<string, unknown>>("series_info", { id: seriesId }).catch(
    () => null,
  );

  if (!data) return { matches: [], squads: [] };

  const matchList = (data.matchList ?? data.matches ?? []) as Record<string, unknown>[];
  const matches = matchList.map(mapLiveMatch);

  const squads: SeriesSquad[] = [];
  const squadBlock = (data.squad ?? data.squads ?? data.teamSquad) as
    | Record<string, unknown>[]
    | undefined;

  if (Array.isArray(squadBlock)) {
    for (const row of squadBlock) {
      const team = String(row.team ?? row.name ?? "Squad");
      const playersRaw = (row.players ?? row.playerList ?? []) as unknown[];
      const players = parseSquadPlayers(playersRaw);
      if (players.length) squads.push({ team, players });
    }
  }

  return { matches, squads };
}

export async function fetchSeriesSquads(seriesId: string): Promise<SeriesSquad[]> {
  const data = await cricFetch<Record<string, unknown>>("series_squads", { id: seriesId }).catch(
    () => null,
  );

  if (!data) return [];

  const squads: SeriesSquad[] = [];
  const list = (data.squads ?? data.squad ?? data.teams ?? data.data) as unknown;

  if (Array.isArray(list)) {
    for (const row of list as Record<string, unknown>[]) {
      const team = String(row.team ?? row.name ?? row.shortname ?? "Squad");
      const playersRaw = (row.players ?? row.playerList ?? row.squad ?? []) as unknown[];
      const players = parseSquadPlayers(playersRaw);
      if (players.length) squads.push({ team, players });
    }
  }

  return squads;
}

export async function fetchUpcomingTours(): Promise<Tour[]> {
  const tours: Tour[] = [];
  const seen = new Set<string>();

  for (let offset = 0; offset < 100; offset += 25) {
    const batch = await cricFetch<unknown[]>("series", { offset: String(offset) }).catch(
      () => [],
    );
    if (!batch.length) break;

    for (const raw of batch as Record<string, unknown>[]) {
      const tour = mapSeriesToTour(raw);
      if (!isFutureSeries(tour.startDate, tour.endDate)) continue;
      if (seen.has(tour.id)) continue;
      seen.add(tour.id);
      tours.push(tour);
    }

    if (batch.length < 25) break;
  }

  return tours.sort((a, b) => {
    const da = a.startDate ? new Date(a.startDate).getTime() : 0;
    const db = b.startDate ? new Date(b.startDate).getTime() : 0;
    return da - db;
  });
}

export async function fetchCurrentMatches(): Promise<LiveMatchSummary[]> {
  const data = await cricFetch<unknown[]>("currentMatches", { offset: "0" });
  return (data as Record<string, unknown>[]).map(mapLiveMatch);
}

/** Recent & upcoming matches list (includes completed). */
export async function fetchMatchesList(maxPages = 4): Promise<LiveMatchSummary[]> {
  const all: LiveMatchSummary[] = [];
  const seen = new Set<string>();

  for (let offset = 0; offset < maxPages * 25; offset += 25) {
    const batch = await cricFetch<unknown[]>("matches", { offset: String(offset) }).catch(
      () => [],
    );
    if (!batch.length) break;

    for (const raw of batch as Record<string, unknown>[]) {
      const match = mapLiveMatch(raw);
      if (!match.id || seen.has(match.id)) continue;
      seen.add(match.id);
      all.push(match);
    }

    if (batch.length < 25) break;
  }

  return all;
}

export async function fetchScorecard(matchId: string): Promise<Scorecard> {
  const data = await cricFetch<Record<string, unknown>>("match_scorecard", { id: matchId });

  const innings: ScorecardInnings[] = [];

  const score = data.score as Record<string, unknown>[] | undefined;
  if (score) {
    for (const inn of score) {
      innings.push({
        inning: String(inn.inning || ""),
        runs: Number(inn.r) || 0,
        wickets: Number(inn.w) || 0,
        overs: Number(inn.o) || 0,
        batting: [],
        bowling: [],
      });
    }
  }

  return {
    id: matchId,
    name: String(data.name || ""),
    status: String(data.status || ""),
    venue: data.venue ? String(data.venue) : undefined,
    teams: data.teams as string[] | undefined,
    innings,
  };
}

export function isCricApiConfigured(): boolean {
  return Boolean(process.env.CRICKET_DATA_API_KEY);
}
