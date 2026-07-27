const CORE_BASE = "http://core.espnuk.org/v2/sports/cricket";

const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

type CoreList = { items?: { $ref: string }[] };

export type LeagueEventRef = {
  eventId: string;
  leagueId: number;
};

export type LeagueEventsOptions = {
  espnLeagueId: number;
  cricinfoSeriesId?: number;
  seasonYear?: number;
  useSeasonEvents?: boolean;
};

const CORE_JSON_CACHE_MS = 20_000;
// Different call paths (live scan, recent-match scan, upcoming-matches scan) independently
// re-request the same league/event URLs within a single page render -- this both dedupes
// concurrent identical requests (same in-flight promise) and short-caches completed ones.
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

/**
 * Events are sometimes only discoverable by querying under the cricinfo series id rather
 * than the ESPN league id (or vice versa) — but every event's own $ref encodes which league
 * it actually belongs to. Trust that instead of assuming espnLeagueId: tagging an event with
 * the wrong league id makes the follow-up competition-detail fetch 404 and silently drop it.
 */
function leagueIdFromRef(ref: string): number | null {
  const match = ref.match(/\/leagues\/(\d+)\//);
  const id = match ? Number(match[1]) : NaN;
  return Number.isFinite(id) ? id : null;
}

/** List event ids for a league — prefers season events for tournaments when configured. */
export async function fetchLeagueEventRefs(
  options: LeagueEventsOptions,
): Promise<LeagueEventRef[]> {
  const leagueIds = [options.espnLeagueId, options.cricinfoSeriesId].filter(
    (id): id is number => Number.isFinite(id),
  );
  const seen = new Set<string>();
  const refs: LeagueEventRef[] = [];

  const urls: string[] = [];
  if (options.useSeasonEvents !== false && options.seasonYear) {
    for (const leagueId of leagueIds) {
      urls.push(
        `${CORE_BASE}/leagues/${leagueId}/seasons/${options.seasonYear}/events?pageSize=100`,
      );
    }
  }
  for (const leagueId of leagueIds) {
    urls.push(`${CORE_BASE}/leagues/${leagueId}/events?pageSize=50`);
  }

  const lists = await Promise.all(
    urls.map(async (url) => {
      const list = await fetchCoreList(url);
      console.log(`[cricket] fetchLeagueEventRefs: GET ${url} → ${list.items?.length ?? 0} item(s)`);
      return list;
    }),
  );

  for (const list of lists) {
    for (const item of list.items ?? []) {
      const eventId = eventIdFromRef(item.$ref);
      if (!eventId || seen.has(eventId)) continue;
      seen.add(eventId);
      const leagueId = leagueIdFromRef(item.$ref) ?? options.espnLeagueId;
      refs.push({ eventId, leagueId });
    }
  }

  return refs;
}

export async function fetchEventTimestamp(leagueId: number, eventId: string): Promise<number> {
  const event = await fetchCoreJson<{ date?: string }>(
    `${CORE_BASE}/leagues/${leagueId}/events/${eventId}`,
  );
  const t = event?.date ? new Date(event.date).getTime() : 0;
  return Number.isNaN(t) ? 0 : t;
}
