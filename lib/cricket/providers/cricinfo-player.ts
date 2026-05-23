const SEARCH_URL = "https://www.espncricinfo.com/ci/content/player/search.html";
const CORE_ATHLETE_URL = "http://core.espnuk.org/v2/sports/cricket/athletes";

/** Cricinfo search blocks non-browser user agents (403). */
const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

type CoreAthlete = {
  fullName?: string;
  headshot?: { href?: string };
};

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function namesMatch(candidate: string, target: string): boolean {
  const a = normalizeName(candidate);
  const b = normalizeName(target);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;

  const aParts = a.split(" ");
  const bParts = b.split(" ");
  const aLast = aParts[aParts.length - 1];
  const bLast = bParts[bParts.length - 1];
  return aLast === bLast && aParts[0] === bParts[0];
}

function searchQueries(playerName: string): string[] {
  const trimmed = playerName.trim();
  const parts = trimmed.split(/\s+/);
  const queries = [trimmed];
  if (parts.length > 2) queries.push(parts.slice(0, 2).join(" "));
  if (parts.length > 1) queries.push(parts[parts.length - 1]);
  return [...new Set(queries)];
}

async function fetchCoreAthlete(id: number): Promise<CoreAthlete | null> {
  try {
    const res = await fetch(`${CORE_ATHLETE_URL}/${id}`, {
      headers: { "User-Agent": BROWSER_USER_AGENT },
      cache: "force-cache",
    });
    if (!res.ok) return null;
    return (await res.json()) as CoreAthlete;
  } catch {
    return null;
  }
}

async function searchPlayerIds(query: string): Promise<number[]> {
  const url = `${SEARCH_URL}?search=${encodeURIComponent(query.replace(/\s+/g, "+"))}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": BROWSER_USER_AGENT,
      Accept: "text/html,application/xhtml+xml",
      Referer: "https://www.espncricinfo.com/",
    },
    cache: "no-store",
  });
  if (!res.ok) return [];

  const html = await res.text();
  const ids = [...html.matchAll(/\/player\/(\d+)\.html/g)].map((m) => Number(m[1]));
  return [...new Set(ids)];
}

export function isCricinfoPlaceholderPhoto(url: string): boolean {
  return (
    url.includes("ui-avatars.com") ||
    url.includes("default-player-logo") ||
    url.includes("/icon512.")
  );
}

/** Find ESPN Cricinfo player ID via public search + core API (free, no API key). */
export async function findCricinfoPlayerId(playerName: string): Promise<number | null> {
  for (const query of searchQueries(playerName)) {
    const ids = await searchPlayerIds(query);
    let fallbackId: number | null = null;

    for (const id of ids.slice(0, 5)) {
      const athlete = await fetchCoreAthlete(id);
      if (!athlete?.fullName || !namesMatch(athlete.fullName, playerName)) continue;

      const href = athlete.headshot?.href;
      if (href && !isCricinfoPlaceholderPhoto(href)) return id;
      if (!fallbackId) fallbackId = id;
    }

    if (fallbackId) return fallbackId;
    if (ids[0]) return ids[0];
  }
  return null;
}

/** Headshot from ESPN Cricinfo / core.espnuk.org (same photos as player profiles). */
export async function resolveCricinfoPlayerImageUrl(playerName: string): Promise<string | null> {
  for (const query of searchQueries(playerName)) {
    const ids = await searchPlayerIds(query);

    for (const id of ids.slice(0, 5)) {
      const athlete = await fetchCoreAthlete(id);
      if (!athlete?.fullName || !namesMatch(athlete.fullName, playerName)) continue;

      const href = athlete.headshot?.href;
      if (href && !isCricinfoPlaceholderPhoto(href)) return href;
    }
  }

  return null;
}
