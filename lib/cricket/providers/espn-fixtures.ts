import { readFile } from "node:fs/promises";
import path from "node:path";

import { resolveMatchStartIso } from "@/lib/cricket/match-sort";
import { isUpcomingBangladeshMatch } from "@/lib/cricket/services/marquee-format";
import { matchTime } from "@/lib/cricket/services/match-highlight";
import { isFutureSeries } from "@/lib/cricket/tour-dates";
import { ordinalSuffix } from "@/lib/cricket/ordinal";
import { readEspnTourSquads } from "@/lib/cricket/squads/store";
import { tourSlug } from "@/lib/cricket/tour-slug";
import type { LiveMatchSummary, Tour } from "@/lib/cricket/types";

import { resolveAllEspnLeaguesForTour, resolveEspnLeagueForTour } from "@/lib/cricket/providers/espn-squads";
import {
  deduplicateTours,
  normalizeTourName,
  parseTourTeamsFromName,
  tourMatchesCuratedSeries as tourMatchesCuratedSeriesIdentity,
  tourNamesShareVenue,
} from "@/lib/cricket/tour-identity";

const CORE_BASE = "http://core.espnuk.org/v2/sports/cricket";
const FIXTURE_TIMES_PATH = path.join(process.cwd(), "data", "espn-fixture-times.json");

const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

type FixtureTimeEntry = {
  date: string;
  matchType?: string;
  dateTimeGMT: string;
  venue?: string;
};

type CuratedSeriesFixtures = {
  tourName?: string;
  cricinfoSeriesId?: number;
  espnLeagueId?: number;
  seasonYear?: number;
  useSeasonEvents?: boolean;
  fixtures: FixtureTimeEntry[];
};

type CuratedFixtureTimesSnapshot = {
  series: Record<string, CuratedSeriesFixtures>;
};

type CoreList = {
  items?: { $ref: string }[];
};

type CoreEvent = {
  date?: string;
  shortDescription?: string;
  competitions?: { date?: string; description?: string; class?: { eventType?: string } }[];
};

type CoreCompetitionDetail = {
  venue?: {
    fullName?: string;
    address?: { city?: string; country?: string };
  };
};

function formatEspnVenue(venue?: CoreCompetitionDetail["venue"]): string | undefined {
  const fullName = venue?.fullName?.trim();
  if (!fullName) return undefined;
  const city = venue?.address?.city?.trim();
  if (city && !fullName.toLowerCase().includes(city.toLowerCase())) {
    return `${fullName}, ${city}`;
  }
  return fullName;
}

type CoreLeague = {
  id?: string;
  name?: string;
  shortName?: string;
  mappings?: { cricinfo?: number };
};

function normalizeTourNameLocal(name: string): string {
  return normalizeTourName(name);
}

function sortToursByStart(tours: Tour[]): Tour[] {
  return tours.sort((a, b) => {
    const da = a.startDate ? new Date(a.startDate).getTime() : 0;
    const db = b.startDate ? new Date(b.startDate).getTime() : 0;
    return da - db;
  });
}

function leagueInvolvesBangladesh(league: CoreLeague): boolean {
  const blob = `${league.name ?? ""} ${league.shortName ?? ""}`.toLowerCase();
  if (!blob.includes("bangladesh")) return false;
  return true;
}

function tourFromFixtures(
  name: string,
  id: string,
  fixtures: FixtureTimeEntry[],
): Tour | null {
  if (!fixtures.length) return null;

  const sorted = [...fixtures].sort((a, b) => a.date.localeCompare(b.date));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const test = fixtures.filter((f) => normalizeMatchType(f.matchType) === "test").length;
  const odi = fixtures.filter((f) => normalizeMatchType(f.matchType) === "odi").length;
  const t20 = fixtures.filter((f) => normalizeMatchType(f.matchType) === "t20").length;

  return {
    id,
    name,
    startDate: first.date,
    endDate: last.date,
    test: test || undefined,
    odi: odi || undefined,
    t20: t20 || undefined,
    matches: fixtures.length,
    teams: teamsFromTourName(name),
  };
}

function normalizeMatchType(matchType?: string): string {
  const mt = (matchType ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (mt === "t20i" || mt === "t20s") return "t20";
  return mt;
}

export function matchDateKey(match: LiveMatchSummary): string {
  const raw = resolveMatchStartIso(match);
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function fixtureLookupKey(date: string, matchType?: string): string {
  const mt = normalizeMatchType(matchType);
  return mt ? `${date}|${mt}` : date;
}

function matchFixtureKey(match: LiveMatchSummary): string {
  return fixtureLookupKey(matchDateKey(match), match.matchType);
}

function eventMatchType(event: CoreEvent): string | undefined {
  const fromClass = event.competitions?.[0]?.class?.eventType;
  if (fromClass) return normalizeMatchType(fromClass);
  const blob = `${event.shortDescription ?? ""} ${event.competitions?.[0]?.description ?? ""}`;
  if (/t20/i.test(blob)) return "t20";
  if (/odi|one-day/i.test(blob)) return "odi";
  if (/test/i.test(blob)) return "test";
  return undefined;
}

async function fetchCoreJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": BROWSER_USER_AGENT },
      signal: AbortSignal.timeout(15000),
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

function addFixtureToLookup(
  lookup: Map<string, string>,
  entry: FixtureTimeEntry,
): void {
  if (!entry.date || !entry.dateTimeGMT) return;
  lookup.set(fixtureLookupKey(entry.date, entry.matchType), entry.dateTimeGMT);
  lookup.set(entry.date, entry.dateTimeGMT);
}

function teamsFromTourName(name: string): string[] | undefined {
  return parseTourTeamsFromName(name);
}

function tourOpponent(teams: string[]): string {
  return teams.find((t) => !/bangladesh/i.test(t)) ?? teams[1] ?? teams[0] ?? "TBC";
}

function tourMatchesCuratedSeries(tour: Tour, series: CuratedSeriesFixtures, seriesId: string): boolean {
  return tourMatchesCuratedSeriesIdentity(
    tour,
    series.tourName ?? "",
    seriesId,
    series.cricinfoSeriesId,
  );
}

function matchTypeLabel(matchType?: string): string {
  const mt = normalizeMatchType(matchType);
  if (mt === "test") return "Test";
  if (mt === "odi") return "ODI";
  if (mt === "t20") return "T20I";
  return "Match";
}

/**
 * Future Bangladesh tours from ESPNcricinfo — curated JSON plus live core API league scan.
 * Used when CricAPI is blocked or has not published the series yet.
 */
export async function fetchEspnFutureTours(): Promise<{ tours: Tour[]; warnings: string[] }> {
  const warnings: string[] = [];
  const tours: Tour[] = [];
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();

  function addTour(tour: Tour): void {
    if (!isFutureSeries(tour.startDate, tour.endDate)) return;
    const nameKey = normalizeTourNameLocal(tour.name);
    if (seenIds.has(tour.id) || seenNames.has(nameKey)) return;
    seenIds.add(tour.id);
    seenNames.add(nameKey);
    tours.push(tour);
  }

  for (const tour of await fetchCuratedEspnTours()) {
    addTour(tour);
  }

  let discoveredLive = 0;
  for (let page = 1; page <= 8; page += 1) {
    const list = await fetchCoreList(`${CORE_BASE}/leagues?page=${page}&pageSize=100`);
    if (!list.items?.length) break;

    for (const item of list.items) {
      const league = await fetchCoreJson<CoreLeague>(item.$ref);
      if (!league?.id || !league.name || !leagueInvolvesBangladesh(league)) continue;

      const cricinfoSeriesId = Number(league.mappings?.cricinfo);
      if (!Number.isFinite(cricinfoSeriesId)) continue;

      const fixtures = await fetchLiveEspnFixtureTimes({
        cricinfoSeriesId,
        espnLeagueId: Number(league.id),
      });
      const tour = tourFromFixtures(league.name, String(cricinfoSeriesId), fixtures);
      if (!tour) continue;

      const before = tours.length;
      addTour(tour);
      if (tours.length > before) discoveredLive += 1;
    }
  }

  if (discoveredLive > 0) {
    warnings.push(`Discovered ${discoveredLive} future Bangladesh series from ESPNcricinfo.`);
  }
  if (tours.length > 0) {
    warnings.push(`ESPNcricinfo: ${tours.length} future tour(s) available.`);
  }

  return { tours: deduplicateTours(sortToursByStart(tours)), warnings };
}

/** Confirmed future series from data/espn-fixture-times.json (not always in CricAPI yet). */
export async function fetchCuratedEspnTours(): Promise<Tour[]> {
  const curated = await readCuratedFixtureTimes();
  const tours: Tour[] = [];

  for (const [seriesId, series] of Object.entries(curated.series)) {
    const fixtures = series.fixtures ?? [];
    if (!fixtures.length || !series.tourName) continue;

    const sorted = [...fixtures].sort((a, b) => a.date.localeCompare(b.date));
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const test = fixtures.filter((f) => normalizeMatchType(f.matchType) === "test").length;
    const odi = fixtures.filter((f) => normalizeMatchType(f.matchType) === "odi").length;
    const t20 = fixtures.filter((f) => normalizeMatchType(f.matchType) === "t20").length;

    const tour: Tour = {
      id: String(series.cricinfoSeriesId ?? seriesId),
      name: series.tourName,
      startDate: first.date,
      endDate: last.date,
      test: test || undefined,
      odi: odi || undefined,
      t20: t20 || undefined,
      matches: fixtures.length,
      teams: teamsFromTourName(series.tourName),
    };

    if (isFutureSeries(tour.startDate, tour.endDate)) {
      tours.push(tour);
    }
  }

  return tours;
}

/** Synthetic fixtures when CricAPI has not published the series matches yet. */
export async function buildMatchesFromCuratedFixtures(tour: Tour): Promise<LiveMatchSummary[]> {
  const curated = await readCuratedFixtureTimes();
  const teams = tour.teams ?? teamsFromTourName(tour.name) ?? ["Bangladesh"];
  const matches: LiveMatchSummary[] = [];

  for (const [seriesId, series] of Object.entries(curated.series)) {
    if (!tourMatchesCuratedSeries(tour, series, seriesId)) continue;

    const counters = new Map<string, number>();
    for (const fixture of [...series.fixtures].sort((a, b) => a.date.localeCompare(b.date))) {
      const mt = normalizeMatchType(fixture.matchType) || "match";
      const n = (counters.get(mt) ?? 0) + 1;
      counters.set(mt, n);
      const label = matchTypeLabel(fixture.matchType);
      const opponent = tourOpponent(teams);

      matches.push({
        id: `curated-${tour.id}-${fixture.date}-${mt}-${n}`,
        name: `${n}${ordinalSuffix(n)} ${label}, Bangladesh vs ${opponent}, ${series.tourName ?? tour.name}`,
        matchType: fixture.matchType,
        status: "Match not started",
        date: fixture.date,
        dateTimeGMT: fixture.dateTimeGMT,
        venue: fixture.venue,
        teams,
        isLive: false,
        seriesId: tour.id,
        seriesName: tour.name,
      });
    }
    break;
  }

  return matches;
}

/** Live fixtures from ESPN core when curated JSON is missing or incomplete. */
export async function buildMatchesFromEspnEvents(tour: Tour): Promise<LiveMatchSummary[]> {
  const league = await leagueForTour(tour);
  if (!league) return [];

  const fixtures = await fetchLiveEspnFixtureTimes(league);
  if (!fixtures.length) return [];

  const teams = tour.teams ?? teamsFromTourName(tour.name) ?? ["Bangladesh"];
  const matches: LiveMatchSummary[] = [];
  const counters = new Map<string, number>();

  for (const fixture of [...fixtures].sort((a, b) => a.date.localeCompare(b.date))) {
    const mt = normalizeMatchType(fixture.matchType) || "match";
    const n = (counters.get(mt) ?? 0) + 1;
    counters.set(mt, n);
    const label = matchTypeLabel(fixture.matchType);
    const opponent = tourOpponent(teams);

    matches.push({
      id: `espn-${tour.id}-${fixture.date}-${mt}-${n}`,
      name: `${n}${ordinalSuffix(n)} ${label}, Bangladesh vs ${opponent}, ${tour.name}`,
      matchType: fixture.matchType,
      status: "Match not started",
      date: fixture.date,
      dateTimeGMT: fixture.dateTimeGMT,
      venue: fixture.venue,
      teams,
      isLive: false,
      seriesId: tour.id,
      seriesName: tour.name,
    });
  }

  return matches;
}

const UPCOMING_GRACE_MS = 15 * 60 * 1000;

/** Confirmed future fixtures from curated JSON — used for the upcoming marquee. */
export async function buildCuratedUpcomingBangladeshMatches(
  limit = 8,
): Promise<LiveMatchSummary[]> {
  const curated = await readCuratedFixtureTimes();
  const now = Date.now();
  const matches: LiveMatchSummary[] = [];

  for (const [seriesId, series] of Object.entries(curated.series)) {
    if (!series.tourName || !series.fixtures?.length) continue;

    const teams = teamsFromTourName(series.tourName) ?? ["Bangladesh"];
    const tourId = String(series.cricinfoSeriesId ?? seriesId);
    const counters = new Map<string, number>();

    for (const fixture of [...series.fixtures].sort((a, b) => a.date.localeCompare(b.date))) {
      const mt = normalizeMatchType(fixture.matchType) || "match";
      const n = (counters.get(mt) ?? 0) + 1;
      counters.set(mt, n);

      const kickoff = new Date(fixture.dateTimeGMT).getTime();
      if (Number.isNaN(kickoff) || kickoff <= now - UPCOMING_GRACE_MS) continue;
      const label = matchTypeLabel(fixture.matchType);
      const opponent = teams.find((t) => !/bangladesh/i.test(t)) ?? teams[0];

      const match: LiveMatchSummary = {
        id: `espn-curated-${tourId}-${fixture.date}-${mt}-${n}`,
        name: `${n}${ordinalSuffix(n)} ${label}, ${teams[0]} vs ${opponent}, ${series.tourName}`,
        matchType: fixture.matchType,
        status: "Match not started",
        date: fixture.date,
        dateTimeGMT: fixture.dateTimeGMT,
        teams,
        isLive: false,
        seriesId: tourId,
        seriesName: series.tourName,
      };

      if (isUpcomingBangladeshMatch(match)) {
        matches.push(match);
      }
    }
  }

  return matches
    .sort((a, b) => matchTime(a) - matchTime(b))
    .slice(0, limit);
}

async function readCuratedFixtureTimes(): Promise<CuratedFixtureTimesSnapshot> {
  try {
    const raw = await readFile(FIXTURE_TIMES_PATH, "utf8");
    return JSON.parse(raw) as CuratedFixtureTimesSnapshot;
  } catch {
    return { series: {} };
  }
}

async function leagueForTour(tour: Tour): Promise<{
  cricinfoSeriesId: number;
  espnLeagueId: number;
  seasonYear?: number;
  useSeasonEvents?: boolean;
} | null> {
  const curated = await readCuratedFixtureTimes();

  if (/^\d+$/.test(tour.id)) {
    for (const [seriesId, series] of Object.entries(curated.series)) {
      const curatedId = String(series.cricinfoSeriesId ?? seriesId);
      if (curatedId !== tour.id) continue;
      if (series.cricinfoSeriesId && series.espnLeagueId) {
        return {
          cricinfoSeriesId: series.cricinfoSeriesId,
          espnLeagueId: series.espnLeagueId,
          seasonYear: series.seasonYear,
          useSeasonEvents: series.useSeasonEvents,
        };
      }
    }
  }

  for (const [seriesId, series] of Object.entries(curated.series)) {
    if (!tourMatchesCuratedSeries(tour, series, seriesId)) continue;
    if (series.cricinfoSeriesId && series.espnLeagueId) {
      return {
        cricinfoSeriesId: series.cricinfoSeriesId,
        espnLeagueId: series.espnLeagueId,
        seasonYear: series.seasonYear,
        useSeasonEvents: series.useSeasonEvents,
      };
    }
  }

  const snapshot = await readEspnTourSquads();
  const keys = [tourSlug(tour), tour.id, tour.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")];

  for (const key of keys) {
    const entry = snapshot.entries[key];
    if (entry?.cricinfoSeriesId && entry?.espnLeagueId) {
      return {
        cricinfoSeriesId: entry.cricinfoSeriesId,
        espnLeagueId: entry.espnLeagueId,
      };
    }
  }

  for (const entry of Object.values(snapshot.entries)) {
    if (!tourNamesShareVenue(tour.name, entry.tourName)) continue;
    if (entry.cricinfoSeriesId && entry.espnLeagueId) {
      return {
        cricinfoSeriesId: entry.cricinfoSeriesId,
        espnLeagueId: entry.espnLeagueId,
      };
    }
  }

  const resolved = await resolveEspnLeagueForTour(tour.name, tour.id);
  if (!resolved) return null;
  return {
    cricinfoSeriesId: resolved.cricinfoSeriesId,
    espnLeagueId: resolved.espnLeagueId,
    seasonYear: tour.startDate ? new Date(tour.startDate).getFullYear() : undefined,
  };
}

export async function espnLeaguesForTour(tour: Tour) {
  const fromCurated = await leaguesForTourFromCurated(tour);
  const fromScan = await resolveAllEspnLeaguesForTour(tour.name, tour.id, tour.startDate);
  const byId = new Map<number, Awaited<ReturnType<typeof leagueForTour>> & object>();

  for (const ref of [...fromCurated, ...fromScan]) {
    byId.set(ref.cricinfoSeriesId, {
      cricinfoSeriesId: ref.cricinfoSeriesId,
      espnLeagueId: ref.espnLeagueId,
      seasonYear: ref.seasonYear ?? (tour.startDate ? new Date(tour.startDate).getFullYear() : undefined),
      useSeasonEvents: ref.useSeasonEvents,
    });
  }

  return [...byId.values()];
}

async function leaguesForTourFromCurated(tour: Tour) {
  const curated = await readCuratedFixtureTimes();
  const refs: {
    cricinfoSeriesId: number;
    espnLeagueId: number;
    seasonYear?: number;
    useSeasonEvents?: boolean;
  }[] = [];

  for (const [seriesId, series] of Object.entries(curated.series)) {
    if (!tourMatchesCuratedSeries(tour, series, seriesId)) continue;
    if (!series.cricinfoSeriesId || !series.espnLeagueId) continue;
    refs.push({
      cricinfoSeriesId: series.cricinfoSeriesId,
      espnLeagueId: series.espnLeagueId,
      seasonYear: series.seasonYear,
      useSeasonEvents: series.useSeasonEvents,
    });
  }

  return refs;
}

export async function espnLeagueForTour(tour: Tour) {
  return leagueForTour(tour);
}

async function fetchLiveEspnFixtureTimes(league: {
  cricinfoSeriesId: number;
  espnLeagueId: number;
}): Promise<FixtureTimeEntry[]> {
  const fixtures: FixtureTimeEntry[] = [];
  const leagueIds = [league.cricinfoSeriesId, league.espnLeagueId];
  const seen = new Set<string>();

  for (const leagueId of leagueIds) {
    const list = await fetchCoreList(`${CORE_BASE}/leagues/${leagueId}/events?pageSize=50`);
    for (const item of list.items ?? []) {
      const eventId = item.$ref.split("/events/")[1]?.split("/")[0];
      if (!eventId || seen.has(eventId)) continue;
      seen.add(eventId);

      const event = await fetchCoreJson<CoreEvent>(item.$ref);
      const iso = event?.competitions?.[0]?.date ?? event?.date;
      if (!iso) continue;

      const date = iso.slice(0, 10);
      // Venue lives on the competition detail resource, not the event summary — fetch it
      // so this fallback fixture source carries a venue like the primary ESPN path does.
      const competition = await fetchCoreJson<CoreCompetitionDetail>(
        `${CORE_BASE}/leagues/${leagueId}/events/${eventId}/competitions/${eventId}`,
      );

      fixtures.push({
        date,
        matchType: eventMatchType(event ?? {}),
        dateTimeGMT: iso.endsWith("Z") ? iso.replace(/(\.\d{3})?Z$/, ".000Z") : `${iso}Z`,
        venue: formatEspnVenue(competition?.venue),
      });
    }
  }

  return fixtures;
}

async function buildFixtureTimeLookup(context?: {
  tour?: Tour;
  seriesIds?: number[];
}): Promise<Map<string, string>> {
  const lookup = new Map<string, string>();
  const curated = await readCuratedFixtureTimes();

  const seriesIds = new Set<number>();
  if (context?.tour) {
    const league = await leagueForTour(context.tour);
    if (league) seriesIds.add(league.cricinfoSeriesId);
  }
  for (const id of context?.seriesIds ?? []) {
    seriesIds.add(id);
  }

  if (seriesIds.size) {
    for (const [id, series] of Object.entries(curated.series)) {
      if (seriesIds.has(Number(id)) || seriesIds.has(series.cricinfoSeriesId ?? -1)) {
        for (const fixture of series.fixtures) addFixtureToLookup(lookup, fixture);
      }
    }

    if (context?.tour) {
      const league = await leagueForTour(context.tour);
      if (league) {
        const live = await fetchLiveEspnFixtureTimes(league);
        for (const fixture of live) addFixtureToLookup(lookup, fixture);
      }
    }
  } else {
    for (const series of Object.values(curated.series)) {
      for (const fixture of series.fixtures) addFixtureToLookup(lookup, fixture);
    }
  }

  return lookup;
}

function applyLookup(
  matches: LiveMatchSummary[],
  lookup: Map<string, string>,
): LiveMatchSummary[] {
  if (!lookup.size) return matches;

  return matches.map((match) => {
    const key = matchFixtureKey(match);
    const dateOnly = matchDateKey(match);
    const corrected = lookup.get(key) ?? lookup.get(dateOnly);
    if (!corrected || corrected === match.dateTimeGMT) return match;
    return { ...match, dateTimeGMT: corrected };
  });
}

/** Prefer ESPNcricinfo start times over CricAPI dateTimeGMT (often 3h off for BD home ODIs). */
export async function enrichMatchFixtureTimes(
  matches: LiveMatchSummary[],
  context?: { tour?: Tour },
): Promise<LiveMatchSummary[]> {
  if (!matches.length) return matches;
  const lookup = await buildFixtureTimeLookup(context);
  return applyLookup(matches, lookup);
}

/** Enrich upcoming Bangladesh fixtures without a tour context. */
export async function enrichUpcomingMatchFixtureTimes(
  matches: LiveMatchSummary[],
): Promise<LiveMatchSummary[]> {
  if (!matches.length) return matches;
  const lookup = await buildFixtureTimeLookup();
  return applyLookup(matches, lookup);
}
