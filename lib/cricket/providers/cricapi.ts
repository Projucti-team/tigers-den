import { CRICAPI_BASE } from "@/lib/cricket/constants";
import type { SeriesSquad, SquadPlayer } from "@/lib/cricket/curated-squads";
import { normalizeSquadPlayers } from "@/lib/cricket/curated-squads";
import { isFutureSeries } from "@/lib/cricket/tour-dates";
import { fetchEspnFutureTours } from "@/lib/cricket/providers/espn-fixtures";
import { isUpcomingBangladeshMatch } from "@/lib/cricket/services/marquee-format";
import { deduplicateTours } from "@/lib/cricket/tour-identity";
import type { LiveMatchSummary, Scorecard, ScorecardInnings, Tour } from "@/lib/cricket/types";

type CricApiResponse<T> = {
  status: string;
  reason?: string;
  data?: T;
  info?: { totalRows?: number };
};

/** Free-tier CricAPI blocks bursts — space calls out during sync. */
const CRICAPI_MIN_INTERVAL_MS = 2_000;
let lastCricApiCallAt = 0;
let cricApiBlocked = false;
/** Index into apiKeys() — advances when a key hits its daily quota. */
let activeKeyIndex = 0;
const cricApiKeyWarnings: string[] = [];

const PRIMARY_KEY_EXHAUSTED = "API key exhausted.";
const BACKUP_KEY_EXHAUSTED = "Backup API key exhausted.";
const BACKUP_KEY_2_EXHAUSTED = "Backup API key 2 exhausted.";

type KeyPool = {
  keys: string[];
  exhaustedMessage: string;
};

function splitEnvKeys(value: string | undefined): string[] {
  return [
    ...new Set(
      (value ?? "")
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean),
    ),
  ];
}

function primaryKeys(): string[] {
  return splitEnvKeys(process.env.CRICKET_DATA_API_KEY);
}

function fallbackKeys(): string[] {
  return splitEnvKeys(process.env.CRICKET_DATA_API_KEY_FALLBACK);
}

function fallback2Keys(): string[] {
  return splitEnvKeys(process.env.CRICKET_DATA_API_KEY_FALLBACK_2);
}

function keyPools(): KeyPool[] {
  return [
    { keys: primaryKeys(), exhaustedMessage: PRIMARY_KEY_EXHAUSTED },
    { keys: fallbackKeys(), exhaustedMessage: BACKUP_KEY_EXHAUSTED },
    { keys: fallback2Keys(), exhaustedMessage: BACKUP_KEY_2_EXHAUSTED },
  ].filter((pool) => pool.keys.length > 0);
}

/**
 * Primary + fallback keys. Supports comma-separated keys per env var and up to three
 * pools: CRICKET_DATA_API_KEY, CRICKET_DATA_API_KEY_FALLBACK, CRICKET_DATA_API_KEY_FALLBACK_2.
 */
function apiKeys(): string[] {
  return [...new Set(keyPools().flatMap((pool) => pool.keys))];
}

function poolIndexForKeyIndex(keyIndex: number): number {
  let offset = 0;
  for (let i = 0; i < keyPools().length; i++) {
    offset += keyPools()[i].keys.length;
    if (keyIndex < offset) return i;
  }
  return Math.max(0, keyPools().length - 1);
}

function pushKeyWarning(message: string): void {
  if (!cricApiKeyWarnings.includes(message)) {
    cricApiKeyWarnings.push(message);
  }
}

export function getCricApiKeyWarnings(): readonly string[] {
  return cricApiKeyWarnings;
}

function blockedUserWarnings(): string[] {
  if (cricApiKeyWarnings.length) return [...cricApiKeyWarnings];
  if (cricApiBlocked) return ["Blocked for 15 minutes"];
  return [];
}

export function beginCricApiSyncSession(): void {
  lastCricApiCallAt = 0;
  cricApiBlocked = false;
  activeKeyIndex = 0;
  cricApiKeyWarnings.length = 0;
}

export function isCricApiBlocked(): boolean {
  return cricApiBlocked;
}

function isQuotaReason(reason: string): boolean {
  // "Blocked for 15 minutes", "rate limit", "hits today exceeded hits limit", HTTP 429…
  return /blocked|rate|quota|hits|limit|exceed|429/i.test(reason);
}

/** Rotate to the next key; only mark blocked when every key is exhausted. */
function handleCricApiFailure(reason: string): void {
  if (!isQuotaReason(reason)) return;

  const pools = keyPools();
  const keys = apiKeys();

  if (activeKeyIndex < keys.length - 1) {
    const oldPool = poolIndexForKeyIndex(activeKeyIndex);
    activeKeyIndex += 1;
    const newPool = poolIndexForKeyIndex(activeKeyIndex);

    if (newPool > oldPool) {
      pushKeyWarning(pools[oldPool].exhaustedMessage);
    }

    console.warn(
      `[cricapi] Key ${activeKeyIndex} quota/rate-limited — switching to fallback key ${activeKeyIndex + 1}/${keys.length}.`,
    );
    return;
  }

  pushKeyWarning(pools[poolIndexForKeyIndex(activeKeyIndex)].exhaustedMessage);
  cricApiBlocked = true;
}

async function waitForCricApiSlot(): Promise<void> {
  if (cricApiBlocked) {
    throw new Error("Blocked for 15 minutes");
  }
  const waitMs = CRICAPI_MIN_INTERVAL_MS - (Date.now() - lastCricApiCallAt);
  if (waitMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
  lastCricApiCallAt = Date.now();
}

function getApiKey(): string {
  const keys = apiKeys();
  if (!keys.length) {
    throw new Error(
      "CRICKET_DATA_API_KEY is not set. Get a free key at https://cricketdata.org/signup.aspx",
    );
  }
  return keys[Math.min(activeKeyIndex, keys.length - 1)];
}

async function cricFetchOnce<T>(path: string, params: Record<string, string>): Promise<T> {
  await waitForCricApiSlot();

  const url = new URL(`${CRICAPI_BASE}/${path}`);
  url.searchParams.set("apikey", getApiKey());
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) {
    const message = `CricAPI HTTP ${res.status} for ${path}`;
    handleCricApiFailure(message);
    throw new Error(message);
  }

  const json = (await res.json()) as CricApiResponse<T>;
  if (json.status !== "success" || !json.data) {
    const reason = json.reason || `CricAPI failed for ${path}`;
    handleCricApiFailure(reason);
    throw new Error(reason);
  }

  return json.data;
}

async function cricFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const attempts = Math.max(apiKeys().length, 1);

  let lastError: unknown;
  for (let i = 0; i < attempts; i += 1) {
    const keyBefore = activeKeyIndex;
    try {
      return await cricFetchOnce<T>(path, params);
    } catch (err) {
      lastError = err;
      // Retry immediately only when the failure rotated us onto a fresh key.
      if (cricApiBlocked || activeKeyIndex === keyBefore) break;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("CricAPI request failed");
}

/** One shared match fetch for sync — avoids duplicate parallel CricAPI bursts. */
export async function prefetchMatchesForSync(): Promise<LiveMatchSummary[]> {
  if (!isCricApiConfigured() || cricApiBlocked) return [];

  const current = await fetchCurrentMatches().catch(() => []);
  const listed = await fetchMatchesList(2).catch(() => []);
  const byId = new Map<string, LiveMatchSummary>();

  for (const match of [...current, ...listed]) {
    if (match.id) byId.set(match.id, match);
  }

  return [...byId.values()];
}

function mapSeriesToTour(s: Record<string, unknown>): Tour {
  const name = String(s.name || "Series");
  const test = Number(s.test) || 0;
  const odi = Number(s.odi) || 0;
  const t20 = Number(s.t20) || 0;
  const matches = Number(s.matches) || test + odi + t20 || 0;
  const teamsRaw = s.teams ?? s.team;
  const teams = Array.isArray(teamsRaw)
    ? teamsRaw.map((t) => String(t)).filter(Boolean)
    : undefined;

  return {
    id: String(s.id || name),
    name,
    startDate: s.startDate ? String(s.startDate) : undefined,
    endDate: s.endDate ? String(s.endDate) : undefined,
    odi,
    t20,
    test,
    matches,
    teams,
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
    isLive:
      /live|in progress|stumps|innings|overs remaining|require.*runs/i.test(m.status || "") ||
      (Array.isArray(m.score) &&
        m.score.length > 0 &&
        !/not started|match starts|won |beat |completed|finished|no result/i.test(
          String(m.status || ""),
        )),
    seriesId: m.series_id ?? m.seriesId ?? m.series?.id,
    seriesName: m.seriesName ?? m.series_name ?? m.series?.name,
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

async function fetchSeriesBatch(
  params: Record<string, string>,
): Promise<{ rows: Record<string, unknown>[]; warning?: string }> {
  try {
    const batch = await cricFetch<unknown[]>("series", params);
    return { rows: batch as Record<string, unknown>[] };
  } catch (e) {
    return {
      rows: [],
      warning: e instanceof Error ? e.message : "CricAPI series request failed",
    };
  }
}

function sortToursByStart(tours: Tour[]): Tour[] {
  return tours.sort((a, b) => {
    const da = a.startDate ? new Date(a.startDate).getTime() : 0;
    const db = b.startDate ? new Date(b.startDate).getTime() : 0;
    return da - db;
  });
}

function normalizeTourName(name: string): string {
  return name
    .toLowerCase()
    .replace(/,?\s*\d{4}(-\d{2})?$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function mergeTour(
  tours: Tour[],
  seenIds: Set<string>,
  seenNames: Set<string>,
  tour: Tour,
): void {
  if (!isFutureSeries(tour.startDate, tour.endDate)) return;

  const nameKey = normalizeTourName(tour.name);
  if (seenIds.has(tour.id) || seenNames.has(nameKey)) return;

  seenIds.add(tour.id);
  seenNames.add(nameKey);
  tours.push(tour);
}

function addFutureTour(
  tours: Tour[],
  seenIds: Set<string>,
  seenNames: Set<string>,
  raw: Record<string, unknown>,
): void {
  mergeTour(tours, seenIds, seenNames, mapSeriesToTour(raw));
}

async function deriveToursFromUpcomingMatches(
  prefetchedMatches?: LiveMatchSummary[],
): Promise<{
  tours: Tour[];
  warnings: string[];
}> {
  const warnings: string[] = [];
  let matches = prefetchedMatches;

  if (!matches?.length) {
    if (cricApiBlocked) {
      return { tours: [], warnings: blockedUserWarnings() };
    }

    const current = await fetchCurrentMatches().catch((e) => {
      warnings.push(e instanceof Error ? e.message : "CricAPI currentMatches failed");
      return [];
    });
    const listed = await fetchMatchesList(2).catch((e) => {
      warnings.push(e instanceof Error ? e.message : "CricAPI matches failed");
      return [];
    });
    const byId = new Map<string, LiveMatchSummary>();
    for (const match of [...current, ...listed]) {
      if (match.id) byId.set(match.id, match);
    }
    matches = [...byId.values()];
  }

  const upcoming = matches.filter((m) => isUpcomingBangladeshMatch(m));
  const groups = new Map<string, LiveMatchSummary[]>();

  for (const match of upcoming) {
    const key = match.seriesId || match.seriesName || match.name.split(",")[0]?.trim() || match.id;
    const list = groups.get(key) ?? [];
    list.push(match);
    groups.set(key, list);
  }

  const tours: Tour[] = [];
  for (const [key, matches] of groups) {
    const sorted = matches
      .filter((m) => m.date || m.dateTimeGMT)
      .sort((a, b) => {
        const da = new Date(a.dateTimeGMT || a.date || 0).getTime();
        const db = new Date(b.dateTimeGMT || b.date || 0).getTime();
        return da - db;
      });

    const first = sorted[0] ?? matches[0];
    const last = sorted[sorted.length - 1] ?? first;
    const seriesId = first.seriesId;
    const name =
      first.seriesName ||
      first.name.replace(/,\s*\d+(?:st|nd|rd|th)?\s+\w+.*$/i, "").trim() ||
      "Bangladesh series";

    const odi = matches.filter((m) => /odi/i.test(m.matchType || m.name)).length;
    const t20 = matches.filter((m) => /t20/i.test(m.matchType || m.name)).length;
    const test = matches.filter((m) => /test/i.test(m.matchType || m.name)).length;

    const teams = [
      ...new Set(
        matches.flatMap((m) => m.teams ?? m.teamInfo?.map((t) => t.name) ?? []).filter(Boolean),
      ),
    ];

    const tour: Tour = {
      id: seriesId || key,
      name,
      startDate: first.date || first.dateTimeGMT,
      endDate: last.date || last.dateTimeGMT,
      odi: odi || undefined,
      t20: t20 || undefined,
      test: test || undefined,
      matches: matches.length,
      teams: teams.length ? teams : undefined,
    };

    tours.push(tour);
  }

  if (tours.length) {
    warnings.push(
      `Built ${tours.length} tour(s) from upcoming Bangladesh fixtures (series list was empty).`,
    );
  }

  return { tours: sortToursByStart(tours), warnings };
}

export async function fetchUpcomingTours(options?: {
  prefetchedMatches?: LiveMatchSummary[];
}): Promise<{ tours: Tour[]; warnings: string[] }> {
  const tours: Tour[] = [];
  const warnings: string[] = [];
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();

  if (!cricApiBlocked) {
    for (const search of ["bangladesh", "bangladesh women"]) {
      const { rows, warning } = await fetchSeriesBatch({ offset: "0", search });
      if (warning) warnings.push(warning);
      for (const raw of rows) addFutureTour(tours, seenIds, seenNames, raw);
    }
  } else {
    warnings.push(...blockedUserWarnings());
  }

  if (!cricApiBlocked) {
    const derived = await deriveToursFromUpcomingMatches(options?.prefetchedMatches);
    warnings.push(...derived.warnings);
    for (const tour of derived.tours) {
      mergeTour(tours, seenIds, seenNames, tour);
    }
  }

  const espn = await fetchEspnFutureTours();
  warnings.push(...espn.warnings);
  for (const tour of espn.tours) {
    mergeTour(tours, seenIds, seenNames, tour);
  }

  if (!tours.length && warnings.length === 0) {
    warnings.push(
      "No future series returned from CricAPI — verify CRICKET_DATA_API_KEY at cricketdata.org or wait if rate-limited.",
    );
  }

  return { tours: deduplicateTours(tours), warnings: [...new Set(warnings)] };
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
  return apiKeys().length > 0;
}
