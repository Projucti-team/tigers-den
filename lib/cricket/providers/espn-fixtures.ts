import { readFile } from "node:fs/promises";
import path from "node:path";

import { readEspnTourSquads } from "@/lib/cricket/squads/store";
import { tourSlug } from "@/lib/cricket/tour-slug";
import type { LiveMatchSummary, Tour } from "@/lib/cricket/types";

import { resolveEspnLeagueForTour } from "@/lib/cricket/providers/espn-squads";

const CORE_BASE = "http://core.espnuk.org/v2/sports/cricket";
const FIXTURE_TIMES_PATH = path.join(process.cwd(), "data", "espn-fixture-times.json");

const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

type FixtureTimeEntry = {
  date: string;
  matchType?: string;
  dateTimeGMT: string;
};

type CuratedSeriesFixtures = {
  tourName?: string;
  cricinfoSeriesId?: number;
  espnLeagueId?: number;
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

function normalizeMatchType(matchType?: string): string {
  return (matchType ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function matchDateKey(match: LiveMatchSummary): string {
  const raw = match.dateTimeGMT || match.date;
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
} | null> {
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
    const blob = tour.name.toLowerCase();
    const tokens = entry.tourName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2);
    const hits = tokens.filter((t) => blob.includes(t));
    if (hits.length >= Math.min(2, tokens.length) && entry.cricinfoSeriesId && entry.espnLeagueId) {
      return {
        cricinfoSeriesId: entry.cricinfoSeriesId,
        espnLeagueId: entry.espnLeagueId,
      };
    }
  }

  const resolved = await resolveEspnLeagueForTour(tour.name);
  if (!resolved) return null;
  return {
    cricinfoSeriesId: resolved.cricinfoSeriesId,
    espnLeagueId: resolved.espnLeagueId,
  };
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
      fixtures.push({
        date,
        matchType: eventMatchType(event ?? {}),
        dateTimeGMT: iso.endsWith("Z") ? iso.replace(/(\.\d{3})?Z$/, ".000Z") : `${iso}Z`,
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
