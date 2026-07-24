import { fetchText } from "@/lib/news/http";
import { fetchSeriesSquads as fetchCricApiSeriesSquads } from "@/lib/cricket/providers/cricapi";
import {
  lookupEspnTourSquads,
  readEspnTourSquads,
  upsertEspnTourSquads,
} from "@/lib/cricket/squads/store";
import {
  profileUrlFromCoreAthlete,
  type CoreAthleteProfile,
} from "@/lib/cricket/squads/profile-urls";
import { resolveSquadPlayers } from "@/lib/cricket/players/registry";
import {
  mergeSquads,
  squadPrimaryNation,
  type SeriesSquad,
  type SquadPlayer,
} from "@/lib/cricket/squads/types";
import {
  extractFormatHint,
  extractOpponentNation,
  isUmbrellaTourName,
  squadBelongsToTour,
  tourNamesShareVenue,
} from "@/lib/cricket/tour-identity";
import { tourSlug, tourStorageKey } from "@/lib/cricket/tour-slug";
import type { Tour } from "@/lib/cricket/types";
import {
  getTourSeriesOverride,
  getTourSquadStoryUrl,
  recordResolvedTourSeries,
} from "@/lib/cricket/services/tour-sync-state-db";
import { isPostgresDatabase } from "@/lib/payload-postgres-url";

/**
 * resolveAllEspnLeaguesForTour is called several times per tour per sync (fixtures, squads,
 * CricAPI squad fallback). Without caching that meant a fresh Postgres pool spun up + torn
 * down for every single one of those calls, across every active tour, every sync run —
 * unnecessary DB churn on a small instance. Cache both directions in-process for a few
 * minutes, which comfortably covers one sync pass.
 */
const OVERRIDE_CACHE_TTL_MS = 5 * 60 * 1000;
const overrideCache = new Map<string, { value: number | null; expiresAt: number }>();
const resolvedCache = new Map<string, string>();
const squadStoryUrlCache = new Map<string, { value: string | null; expiresAt: number }>();

/** Call after an admin sets/clears an override so the next sync doesn't read a stale cached value. */
export function invalidateTourSeriesOverrideCache(tourId: string): void {
  overrideCache.delete(tourId);
  resolvedCache.delete(tourId);
  squadStoryUrlCache.delete(tourId);
}

/** Best-effort — tour_sync_state may not exist yet (fresh tour) or DB may be SQLite in dev. */
async function getTourSeriesOverrideSafe(tourId: string): Promise<number | null> {
  if (!isPostgresDatabase()) return null;

  const cached = overrideCache.get(tourId);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  try {
    const value = await getTourSeriesOverride(tourId);
    overrideCache.set(tourId, { value, expiresAt: Date.now() + OVERRIDE_CACHE_TTL_MS });
    return value;
  } catch {
    return null;
  }
}

/** Best-effort — admin-pinned squad story URL(s) for a tour, split into a clean array. */
async function getTourSquadStoryUrlsSafe(tourId: string): Promise<string[]> {
  if (!isPostgresDatabase()) return [];

  const cached = squadStoryUrlCache.get(tourId);
  const raw =
    cached && cached.expiresAt > Date.now()
      ? cached.value
      : await (async () => {
          try {
            const value = await getTourSquadStoryUrl(tourId);
            squadStoryUrlCache.set(tourId, { value, expiresAt: Date.now() + OVERRIDE_CACHE_TTL_MS });
            return value;
          } catch {
            return null;
          }
        })();

  if (!raw) return [];
  return raw
    .split(/[\n,]+/)
    .map((u) => u.trim())
    .filter(Boolean);
}

/** Best-effort — records which series a sync resolved to, for the admin panel. Never throws. */
async function recordResolvedTourSeriesSafe(
  tourId: string,
  cricinfoSeriesId: number,
  espnLeagueId: number,
): Promise<void> {
  if (!isPostgresDatabase()) return;

  const key = `${cricinfoSeriesId}:${espnLeagueId}`;
  if (resolvedCache.get(tourId) === key) return;

  try {
    await recordResolvedTourSeries(tourId, cricinfoSeriesId, espnLeagueId);
    resolvedCache.set(tourId, key);
  } catch {
    // tour_sync_state row may not exist yet — safe to ignore.
  }
}

const CORE_BASE = "http://core.espnuk.org/v2/sports/cricket";

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

type CoreAthlete = CoreAthleteProfile;

type CoreRoster = {
  entries?: CoreAthleteEntry[];
};

type EspnLeagueRef = {
  espnLeagueId: number;
  cricinfoSeriesId: number;
  seasonYear?: number;
  useSeasonEvents?: boolean;
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

function leagueMatchesTour(league: CoreLeague, tourName: string): boolean {
  const leagueName = `${league.name ?? ""} ${league.shortName ?? ""}`.trim();
  if (!leagueName) return false;
  return tourNamesShareVenue(tourName, leagueName);
}

/** Resolve ESPN core league + Cricinfo series id from tour title. */
export async function resolveEspnLeagueForTour(
  tourName: string,
  tourId?: string,
): Promise<EspnLeagueRef | null> {
  const all = await resolveAllEspnLeaguesForTour(tourName, tourId);
  if (!all.length) return null;

  if (tourId && /^\d+$/.test(tourId)) {
    const exact = all.find((ref) => String(ref.cricinfoSeriesId) === tourId);
    if (exact) return exact;
  }

  return all[0] ?? null;
}

/** All format-specific ESPN leagues for an umbrella bilateral tour (Test, ODI, T20). */
export async function resolveAllEspnLeaguesForTour(
  tourName: string,
  tourId?: string,
  startDate?: string,
): Promise<EspnLeagueRef[]> {
  const refs: EspnLeagueRef[] = [];
  const seen = new Set<number>();

  function add(ref: EspnLeagueRef): void {
    if (seen.has(ref.cricinfoSeriesId)) return;
    seen.add(ref.cricinfoSeriesId);
    refs.push(ref);
  }

  // Admin-pinned series wins outright — skip auto-discovery entirely when set.
  if (tourId) {
    const override = await getTourSeriesOverrideSafe(tourId);
    if (override) {
      // CricAPI fixture/squad lookups only ever use cricinfoSeriesId, not espnLeagueId — so
      // even when we can't map the override to a distinct ESPN league id, still honor it with
      // a placeholder (cricinfoSeriesId itself, the same sentinel normalizeLeagueRef already
      // treats as "unresolved, try to correct me"). Failing to resolve an ESPN-side id must
      // never mean silently falling back to the auto-discovery scan that mismatched in the
      // first place.
      const espnLeagueId = (await resolveEspnLeagueByCricinfoId(override)) ?? override;
      add({
        cricinfoSeriesId: override,
        espnLeagueId,
        seasonYear: startDate ? new Date(startDate).getFullYear() : undefined,
        useSeasonEvents: true,
      });
      await recordResolvedTourSeriesSafe(tourId, override, espnLeagueId);
      return refs;
    }
  }

  const snapshot = await readEspnTourSquads();
  for (const entry of Object.values(snapshot.entries)) {
    if (!tourNamesShareVenue(tourName, entry.tourName)) continue;
    if (entry.cricinfoSeriesId && entry.espnLeagueId) {
      add({ cricinfoSeriesId: entry.cricinfoSeriesId, espnLeagueId: entry.espnLeagueId });
    }
  }

  let fallback: EspnLeagueRef | null = null;

  for (let page = 1; page <= 8; page++) {
    const list = await fetchCoreList(`${CORE_BASE}/leagues?page=${page}&pageSize=100`);
    if (!list.items?.length) break;

    for (const item of list.items) {
      const league = await fetchCoreJson<CoreLeague>(item.$ref);
      if (!league?.id || !leagueMatchesTour(league, tourName)) continue;

      const cricinfoSeriesId = Number(league.mappings?.cricinfo);
      if (!Number.isFinite(cricinfoSeriesId)) continue;

      const ref: EspnLeagueRef = {
        espnLeagueId: Number(league.id),
        cricinfoSeriesId,
        seasonYear: startDate ? new Date(startDate).getFullYear() : undefined,
      };

      if (tourId && /^\d+$/.test(tourId) && tourId === String(cricinfoSeriesId)) {
        add(ref);
        continue;
      }

      if (isUmbrellaTourName(tourName)) {
        add(ref);
        continue;
      }

      if (!fallback) fallback = ref;
    }
  }

  if (fallback && !refs.length) {
    add(fallback);
  }

  if (tourId && refs.length) {
    await recordResolvedTourSeriesSafe(tourId, refs[0].cricinfoSeriesId, refs[0].espnLeagueId);
  }

  return refs;
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
  const h = heading.trim().replace(/\s+/g, " ");

  // Keep full headlines like "Bangladesh squad for one-off Test vs Zimbabwe".
  if (/\b(?:vs\.?|against|in)\s+(?:the\s+)?[a-z]/i.test(h)) return h;

  const nationMatch = h.match(
    /^(bangladesh|australia|england|india|pakistan|sri lanka|new zealand|south africa|west indies|zimbabwe)\b/i,
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

    players.push({
      name,
      profileUrl: athlete ? profileUrlFromCoreAthlete(athlete) : null,
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
    players.push({
      name,
      profileUrl: athlete ? profileUrlFromCoreAthlete(athlete) : null,
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
      `${CORE_BASE}/leagues/${league.espnLeagueId}/events/${eventId}/competitions/${eventId}/competitors`,
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

async function fetchSquadsFromStoryUrls(urls: string[]): Promise<SeriesSquad[]> {
  const squads: SeriesSquad[] = [];

  for (const rawUrl of urls) {
    const url = rawUrl.split("?")[0];
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
      // Fall back to bundled JSON squads when ESPN blocks the server.
    }
  }

  return squads;
}

function lookupKeysForTour(tour: Tour): string[] {
  const storageKey = tourStorageKey(tour);
  const slug = tourSlug(tour);
  return [
    storageKey,
    slug,
    tour.id,
    tour.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
  ];
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
  return tourNamesShareVenue(a, b);
}

/**
 * Map a known cricinfo series id to its ESPN core league id. For many bilateral series the
 * two ids line up directly, so try that as a single cheap request first. Otherwise fall back
 * to scanning the leagues list (expensive — one request per league — so only worth doing for
 * a targeted lookup like this or an admin-pinned override, not the per-sync discovery scan).
 */
async function resolveEspnLeagueByCricinfoId(cricinfoSeriesId: number): Promise<number | null> {
  const direct = await fetchCoreJson<CoreLeague>(`${CORE_BASE}/leagues/${cricinfoSeriesId}`);
  if (direct?.id && Number(direct.mappings?.cricinfo) === cricinfoSeriesId) {
    return Number(direct.id);
  }

  for (let page = 1; page <= 15; page++) {
    const list = await fetchCoreList(`${CORE_BASE}/leagues?page=${page}&pageSize=100`);
    if (!list.items?.length) break;

    for (const item of list.items) {
      const league = await fetchCoreJson<CoreLeague>(item.$ref);
      if (Number(league?.mappings?.cricinfo) === cricinfoSeriesId && league?.id) {
        return Number(league.id);
      }
    }
  }

  return null;
}

async function normalizeLeagueRef(league: EspnLeagueRef): Promise<EspnLeagueRef> {
  if (league.espnLeagueId !== league.cricinfoSeriesId) return league;

  const espnLeagueId = await resolveEspnLeagueByCricinfoId(league.cricinfoSeriesId);
  if (!espnLeagueId) return league;

  return { ...league, espnLeagueId };
}

/** Fast path — read squads from bundled seed + data/espn-tour-squads.json. */
export async function loadEspnTourSquadsFromCache(tour: Tour): Promise<SeriesSquad[]> {
  const snapshot = await readEspnTourSquads();
  const keys = lookupKeysForTour(tour);
  const direct = lookupEspnTourSquads(snapshot, keys);
  const lists: SeriesSquad[][] = direct.length ? [direct] : [];

  for (const entry of Object.values(snapshot.entries)) {
    if (tourNamesMatch(tour.name, entry.tourName)) {
      lists.push(entry.squads.filter((squad) => squadBelongsToTour(squad, tour)));
    }
  }

  return lists.length
    ? mergeSquads(...lists).filter((squad) => squadBelongsToTour(squad, tour))
    : [];
}

/** Best-effort — CricAPI has no squad data for most series yet; never let it fail the sync. */
async function fetchSquadsFromCricApi(tour: Tour): Promise<SeriesSquad[]> {
  try {
    return await fetchCricApiSeriesSquads(tour.id);
  } catch {
    return [];
  }
}

/**
 * Refresh squads. Preference order: CricAPI (structured, cheapest) and ESPN's Core Sports
 * API (structured, no scraping) run automatically every sync; if neither has published a
 * squad yet, fall back to whatever story URL an admin has pinned for this tour via the
 * admin panel (a single deliberate, human-verified fetch+parse — not automatic discovery).
 * We deliberately don't scrape ESPN's client-rendered squads pages any more: it was fragile
 * (client-side-only rendering, bot detection) and broke on every ESPN layout change.
 */
export async function refreshEspnTourSquads(tour: Tour): Promise<{
  squads: SeriesSquad[];
  warnings: string[];
}> {
  const warnings: string[] = [];
  const keys = lookupKeysForTour(tour);
  const snapshot = await readEspnTourSquads();
  const cached = lookupEspnTourSquads(snapshot, keys);

  const rawLeague = leagueFromSnapshot(snapshot, keys) ?? (await resolveEspnLeagueForTour(tour.name, tour.id));
  const league = rawLeague ? await normalizeLeagueRef(rawLeague) : null;

  const adminStoryUrls = await getTourSquadStoryUrlsSafe(tour.id);
  const curatedStoryUrls = [
    ...adminStoryUrls,
    ...keys.map((key) => snapshot.entries[key]?.squadStoryUrls ?? []).flat(),
  ];

  const cricApiSquads = (await fetchSquadsFromCricApi(tour)).filter((s) =>
    squadBelongsToTour(s, tour),
  );
  const coreSquads = league ? await fetchSquadsFromEspnCore(league) : [];
  const curatedSquads = (await fetchSquadsFromStoryUrls(curatedStoryUrls)).filter((s) =>
    squadBelongsToTour(s, tour),
  );
  console.log(
    `[cricket] ${tourSlug(tour)}: squad sources — cricapi=${cricApiSquads.length} core=${coreSquads.length} story(curated/admin)=${curatedSquads.length} cached=${cached.length}` +
      (adminStoryUrls.length ? ` | admin-pinned URLs: ${adminStoryUrls.join(", ")}` : ""),
  );
  const merged = mergeSquads(cached, cricApiSquads, coreSquads, curatedSquads);
  const squads: SeriesSquad[] = [];

  for (const squad of merged) {
    squads.push({
      ...squad,
      players: await resolveSquadPlayers(squadPrimaryNation(squad.team), squad.players),
    });
  }

  if (squads.length) {
    const storageKey = tourStorageKey(tour);
    const existingEntry = snapshot.entries[storageKey];
    await upsertEspnTourSquads(storageKey, {
      tourName: tour.name,
      espnLeagueId: league?.espnLeagueId,
      cricinfoSeriesId: league?.cricinfoSeriesId,
      squadStoryUrls: existingEntry?.squadStoryUrls,
      squads,
    });
  } else if (!league) {
    warnings.push("Could not match this series on ESPNcricinfo yet.");
  } else {
    warnings.push(
      "Squads not published yet — check back closer to the first match, or add a news link in the admin panel.",
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
        !w.startsWith("Could not match this series on ESPNcricinfo"),
    ),
    ...freshWarnings,
  ];

  if (!squads.length && !warnings.some((w) => w.includes("Squads not published"))) {
    warnings.push(
      "Squads not published yet — check back closer to the first match, or add a news link in the admin panel.",
    );
  }

  return { ...detail, squads, warnings };
}
