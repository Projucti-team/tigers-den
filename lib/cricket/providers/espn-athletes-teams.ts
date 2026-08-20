const CORE_BASE = "http://core.espnuk.org/v2/sports/cricket";

const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function fetchCoreJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": BROWSER_USER_AGENT },
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export type EspnAthleteInfo = { id: number; displayName: string };

/** Resolves a player's ESPN Core athlete record from the id embedded in their cricinfo URL. */
export async function fetchEspnAthleteInfo(athleteId: number): Promise<EspnAthleteInfo | null> {
  const data = await fetchCoreJson<{ id?: string; displayName?: string; name?: string }>(
    `${CORE_BASE}/athletes/${athleteId}`,
  );
  if (!data?.id) return null;
  return { id: Number(data.id), displayName: data.displayName || data.name || `Athlete ${athleteId}` };
}

function leagueIdFromRef(ref: string | undefined): number | null {
  const match = ref?.match(/\/leagues\/(\d+)\//);
  const id = match ? Number(match[1]) : NaN;
  return Number.isFinite(id) ? id : null;
}

export type EspnTeamInfo = {
  id: number;
  displayName: string;
  /** League of the team's current/nearest fixture — covers whatever competition is on right now. */
  currentEventLeagueId: number | null;
  /** Team's primary/home competition — a stable fallback when nothing is currently scheduled. */
  defaultLeagueId: number | null;
};

/**
 * Resolves a team's ESPN Core team record from the id embedded in their cricinfo URL. The `event`
 * and `defaultLeague` refs on this object are how a team's current competition is discovered
 * without scraping the (JS-rendered) public cricinfo team page — confirmed live against
 * core.espnuk.org/v2/sports/cricket/teams/1098 (Kent), which returns both.
 */
export async function fetchEspnTeamInfo(teamId: number): Promise<EspnTeamInfo | null> {
  const data = await fetchCoreJson<{
    id?: string;
    displayName?: string;
    name?: string;
    event?: { $ref?: string };
    defaultLeague?: { $ref?: string };
  }>(`${CORE_BASE}/teams/${teamId}`);
  if (!data?.id) return null;

  return {
    id: Number(data.id),
    displayName: data.displayName || data.name || `Team ${teamId}`,
    currentEventLeagueId: leagueIdFromRef(data.event?.$ref),
    defaultLeagueId: leagueIdFromRef(data.defaultLeague?.$ref),
  };
}
