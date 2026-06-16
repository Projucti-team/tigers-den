import { fetchText } from "@/lib/news/http";
import { parseRssItems } from "@/lib/news/providers/rss-parse";
import {
  lookupEspnTourSquads,
  readEspnTourSquads,
  upsertEspnTourSquads,
} from "@/lib/cricket/squads/store";
import {
  cricinfoPlayerUrl,
  mergeSquads,
  normalizeSquadPlayers,
  squadKey,
  type SeriesSquad,
  type SquadPlayer,
} from "@/lib/cricket/squads/types";
import { tourSlug } from "@/lib/cricket/tour-slug";
import type { Tour } from "@/lib/cricket/types";

const CORE_BASE = "http://core.espnuk.org/v2/sports/cricket";
const ESPN_RSS_URL = "https://www.espncricinfo.com/rss/content/story/feeds/0.xml";

const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

type CoreList = {
  count?: number;
  items?: { $ref: string }[];
};

type CoreLeague = {
  id?: string;
  name?: string;
  shortName?: string;
  mappings?: { cricinfo?: number };
  teams?: { $ref: string };
  events?: { $ref: string };
};

type CoreTeam = {
  id?: string;
  displayName?: string;
  athletes?: { $ref: string };
};

type CoreAthleteEntry = {
  athlete?: { $ref: string };
};

type CoreAthlete = {
  id?: string;
  fullName?: string;
  displayName?: string;
};

type CoreRoster = {
  entries?: CoreAthleteEntry[];
};

type EspnLeagueRef = {
  espnLeagueId: number;
  cricinfoSeriesId: number;
};

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

function tourTokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !["tour", "the", "of", "in", "vs"].includes(w));
}

function leagueMatchesTour(league: CoreLeague, tourName: string): boolean {
  const blob = `${league.name ?? ""} ${league.shortName ?? ""}`.toLowerCase();
  const tokens = tourTokens(tourName);
  if (!tokens.length) return false;
  const hits = tokens.filter((t) => blob.includes(t));
  return hits.length >= Math.min(2, tokens.length);
}

/** Resolve ESPN core league + Cricinfo series id from tour title. */
export async function resolveEspnLeagueForTour(tourName: string): Promise<EspnLeagueRef | null> {
  for (let page = 1; page <= 8; page++) {
    const list = await fetchCoreList(`${CORE_BASE}/leagues?page=${page}&pageSize=100`);
    if (!list.items?.length) break;

    for (const item of list.items) {
      const league = await fetchCoreJson<CoreLeague>(item.$ref);
      if (!league?.id || !leagueMatchesTour(league, tourName)) continue;

      const cricinfoSeriesId = Number(league.mappings?.cricinfo);
      if (!Number.isFinite(cricinfoSeriesId)) continue;

      return {
        espnLeagueId: Number(league.id),
        cricinfoSeriesId,
      };
    }
  }

  return null;
}

function parsePlayerNames(block: string): SquadPlayer[] {
  const cleaned = block
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return [];

  return cleaned
    .split(/,(?![^(]*\))/)
    .map((part) => part.trim())
    .filter((name) => name.length > 2 && !/^(and|the|for|with)$/i.test(name))
    .map((name) => ({ name }));
}

function normalizeSquadHeading(heading: string): string {
  const h = heading.trim();
  const nationMatch = h.match(
    /^(bangladesh|australia|england|india|pakistan|sri lanka|new zealand|south africa|west indies)\b/i,
  );
  if (!nationMatch) return h;

  const nation = nationMatch[1]
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
  const format = /\bt20/i.test(h)
    ? "T20I"
    : /\bodi\b/i.test(h)
      ? "ODI"
      : /\btest\b/i.test(h)
        ? "Test"
        : null;

  return format ? `${nation} — ${format} squad` : h;
}

/** Parse squad lists from an ESPNcricinfo story HTML page. */
export function parseSquadsFromStoryHtml(html: string, source: string): SeriesSquad[] {
  const squads: SeriesSquad[] = [];
  const body = html.replace(/<script[\s\S]*?<\/script>/gi, " ");

  const headingPatterns = [
    /<h[23][^>]*>([^<]*squad[^<]*)<\/h[23]>\s*([\s\S]*?)(?=<h[23]|$)/gi,
    /##\s*([^\n#]*squad[^\n#]*)\n+([\s\S]*?)(?=\n##|\n#|$)/gi,
  ];

  for (const re of headingPatterns) {
    let match: RegExpExecArray | null;
    while ((match = re.exec(body)) !== null) {
      const heading = match[1].replace(/<[^>]+>/g, "").trim();
      const block = match[2];
      const listMatch =
        block.match(/Squad:\s*([^<\n]+)/i)?.[1] ??
        block.match(/<p[^>]*>([^<]{20,})<\/p>/i)?.[1] ??
        block.replace(/<[^>]+>/g, " ").trim();

      const players = parsePlayerNames(listMatch);
      if (players.length >= 8) {
        squads.push({ team: normalizeSquadHeading(heading), players, source });
      }
    }
  }

  const inlineSquad = body.match(/Squad:\s*([^<\n]{40,})/gi);
  if (!squads.length && inlineSquad) {
    for (const row of inlineSquad) {
      const list = row.replace(/^Squad:\s*/i, "");
      const players = parsePlayerNames(list);
      if (players.length >= 8) {
        squads.push({
          team: "Squad",
          players,
          source,
        });
      }
    }
  }

  return squads;
}

async function fetchAthletesFromRef(url: string): Promise<SquadPlayer[]> {
  const list = await fetchCoreList(url);
  const players: SquadPlayer[] = [];

  for (const item of list.items ?? []) {
    const entry = await fetchCoreJson<CoreAthleteEntry>(item.$ref);
    const athleteRef = entry?.athlete?.$ref;
    if (!athleteRef) continue;

    const athlete = await fetchCoreJson<CoreAthlete>(athleteRef);
    const name = athlete?.fullName ?? athlete?.displayName;
    if (!name) continue;

    const id = Number(athlete?.id);
    players.push({
      name,
      profileUrl: Number.isFinite(id) ? cricinfoPlayerUrl(id, name) : null,
    });
  }

  return players;
}

/** League-level athlete lists are often duplicates of story squads — skip bare country names. */
function isGenericCountrySquad(label: string): boolean {
  const n = label.trim().toLowerCase();
  if (/\b(odi|t20|test)\b/i.test(n) || /\s[—–-]\s/.test(label)) return false;
  return /^(australia|bangladesh|england|india|pakistan|sri lanka|new zealand|west indies)$/.test(
    n,
  );
}

async function fetchRosterSquad(
  rosterUrl: string,
  teamLabel: string,
  source: string,
): Promise<SeriesSquad | null> {
  if (isGenericCountrySquad(teamLabel)) return null;
  const roster = await fetchCoreJson<CoreRoster>(rosterUrl);
  if (!roster?.entries?.length) return null;

  const players: SquadPlayer[] = [];
  for (const entry of roster.entries) {
    const athleteRef = entry.athlete?.$ref;
    if (!athleteRef) continue;
    const athlete = await fetchCoreJson<CoreAthlete>(athleteRef);
    const name = athlete?.fullName ?? athlete?.displayName;
    if (!name) continue;
    const id = Number(athlete?.id);
    players.push({
      name,
      profileUrl: Number.isFinite(id) ? cricinfoPlayerUrl(id, name) : null,
    });
  }

  if (players.length < 8) return null;
  return { team: teamLabel, players, source };
}

/** Squads from ESPN core API (league team athletes + match rosters when published). */
export async function fetchSquadsFromEspnCore(league: EspnLeagueRef): Promise<SeriesSquad[]> {
  const source = `https://www.espncricinfo.com/series/_/id/${league.cricinfoSeriesId}`;
  const squads: SeriesSquad[] = [];

  const teamsList = await fetchCoreList(
    `${CORE_BASE}/leagues/${league.espnLeagueId}/teams?pageSize=50`,
  );

  for (const item of teamsList.items ?? []) {
    const team = await fetchCoreJson<CoreTeam>(item.$ref);
    if (!team?.displayName || !team.athletes?.$ref) continue;
    if (isGenericCountrySquad(team.displayName)) continue;

    const players = await fetchAthletesFromRef(team.athletes.$ref);
    if (players.length >= 8) {
      squads.push({
        team: team.displayName,
        players,
        source,
      });
    }
  }

  const eventsList = await fetchCoreList(
    `${CORE_BASE}/leagues/${league.espnLeagueId}/events?pageSize=50`,
  );

  for (const eventRef of eventsList.items ?? []) {
    const eventId = eventRef.$ref.split("/events/")[1]?.split("/")[0];
    if (!eventId) continue;

    const competitors = await fetchCoreList(
      `${CORE_BASE}/leagues/${league.cricinfoSeriesId}/events/${eventId}/competitions/${eventId}/competitors`,
    );

    for (const compRef of competitors.items ?? []) {
      const rosterUrl = `${compRef.$ref}/roster`;
      const teamId = compRef.$ref.split("/competitors/")[1];
      const team = await fetchCoreJson<CoreTeam>(`${CORE_BASE}/teams/${teamId}`);
      const label = team?.displayName ?? `Team ${teamId}`;
      const squad = await fetchRosterSquad(rosterUrl, label, source);
      if (squad) squads.push(squad);
    }
  }

  return squads;
}

function storyMatchesTour(title: string, tourName: string): boolean {
  const blob = title.toLowerCase();
  const tokens = tourTokens(tourName);
  const hits = tokens.filter((t) => blob.includes(t));
  if (hits.length < 1) return false;

  // Explicit squad headlines, e.g. "Australia squad for T20Is in Bangladesh".
  if (/\bsquad\b/i.test(blob)) return true;

  // ESPN often titles announcements without "squad", e.g. "X return for T20Is against Australia".
  if (/\bt20/i.test(blob)) return true;

  return false;
}

/** Discover squad announcements via ESPNcricinfo RSS and parse story pages. */
export async function fetchSquadsFromEspnStories(tourName: string): Promise<SeriesSquad[]> {
  let xml: string;
  try {
    xml = await fetchText(ESPN_RSS_URL, { cache: "no-store" });
  } catch {
    return [];
  }

  const items = parseRssItems(xml).filter((item) => storyMatchesTour(item.title, tourName));
  const squads: SeriesSquad[] = [];

  for (const item of items.slice(0, 4)) {
    const url = item.link.split("?")[0];
    if (!url) continue;

    try {
      const html = await fetchText(url, {
        cache: "no-store",
        headers: {
          "User-Agent": BROWSER_USER_AGENT,
          Accept: "text/html",
          Referer: "https://www.espncricinfo.com/",
        },
      });
      squads.push(...parseSquadsFromStoryHtml(html, url));
    } catch {
      // Story HTML may be blocked on some hosts — JSON cache covers this.
    }
  }

  return squads;
}

function lookupKeysForTour(tour: Tour): string[] {
  const slug = tourSlug(tour);
  return [slug, tour.id, tour.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")];
}

function leagueFromSnapshot(
  snapshot: Awaited<ReturnType<typeof readEspnTourSquads>>,
  keys: string[],
): EspnLeagueRef | null {
  for (const key of keys) {
    const entry = snapshot.entries[key];
    if (entry?.espnLeagueId && entry?.cricinfoSeriesId) {
      return {
        espnLeagueId: entry.espnLeagueId,
        cricinfoSeriesId: entry.cricinfoSeriesId,
      };
    }
  }
  return null;
}

function tourNamesMatch(a: string, b: string): boolean {
  const tokens = tourTokens(a);
  const blob = b.toLowerCase();
  if (!tokens.length) return false;
  const hits = tokens.filter((t) => blob.includes(t));
  return hits.length >= Math.min(2, tokens.length);
}

/** Fast path — read squads from data/espn-tour-squads.json only. */
export async function loadEspnTourSquadsFromCache(tour: Tour): Promise<SeriesSquad[]> {
  const snapshot = await readEspnTourSquads();
  const direct = lookupEspnTourSquads(snapshot, lookupKeysForTour(tour));
  if (direct.length) return direct;

  for (const entry of Object.values(snapshot.entries)) {
    if (tourNamesMatch(tour.name, entry.tourName)) {
      return entry.squads;
    }
  }

  return [];
}

/**
 * Refresh squads from ESPNcricinfo (core API + story RSS + cache).
 * CricAPI is not used for squads.
 */
export async function refreshEspnTourSquads(tour: Tour): Promise<{
  squads: SeriesSquad[];
  warnings: string[];
}> {
  const warnings: string[] = [];
  const keys = lookupKeysForTour(tour);
  const snapshot = await readEspnTourSquads();
  const cached = lookupEspnTourSquads(snapshot, keys);

  const league = leagueFromSnapshot(snapshot, keys) ?? (await resolveEspnLeagueForTour(tour.name));

  const coreSquads = league ? await fetchSquadsFromEspnCore(league) : [];
  const storySquads = await fetchSquadsFromEspnStories(tour.name);
  const squads = mergeSquads(cached, coreSquads, storySquads);

  if (squads.length) {
    await upsertEspnTourSquads(keys[0], {
      tourName: tour.name,
      espnLeagueId: league?.espnLeagueId,
      cricinfoSeriesId: league?.cricinfoSeriesId,
      squads,
    });
  } else if (!league) {
    warnings.push("Could not match this series on ESPNcricinfo yet.");
  } else {
    warnings.push(
      "Squads not published on ESPNcricinfo yet — check back closer to the first match.",
    );
  }

  return { squads, warnings };
}

/** @alias refreshEspnTourSquads */
export const fetchEspnTourSquads = refreshEspnTourSquads;

/** Clean squad-related warnings and apply fresh ESPN squads on cached tour pages. */
export function applyEspnTourSquads<T extends { tour: Tour; squads: SeriesSquad[]; warnings: string[] }>(
  detail: T,
  freshSquads: SeriesSquad[],
  freshWarnings: string[] = [],
): T {
  const squads = freshSquads.length ? freshSquads : detail.squads;

  const warnings = [
    ...detail.warnings.filter(
      (w) =>
        !w.startsWith("Squads not published") &&
        !w.includes("CricAPI") &&
        !w.includes("Australia squads sourced") &&
        !w.includes("Could not match this series on ESPNcricinfo"),
    ),
    ...freshWarnings,
  ];

  if (!squads.length && !warnings.some((w) => w.includes("Squads not published"))) {
    warnings.push(
      "Squads not published on ESPNcricinfo yet — check back closer to the first match.",
    );
  }

  return { ...detail, squads, warnings };
}

export { normalizeSquadPlayers, squadKey, mergeSquads };
