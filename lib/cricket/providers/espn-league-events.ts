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

  for (const url of urls) {
    const list = await fetchCoreList(url);
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
