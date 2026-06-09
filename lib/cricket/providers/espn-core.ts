export const ESPN_CORE_BASE = "http://core.espnuk.org/v2/sports/cricket";

export const ESPN_BROWSER_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export type CoreList = { items?: { $ref: string }[]; pageCount?: number; count?: number };

export async function fetchEspnCoreJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": ESPN_BROWSER_USER_AGENT },
      signal: AbortSignal.timeout(18_000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function fetchEspnCoreList(url: string): Promise<CoreList> {
  return (await fetchEspnCoreJson<CoreList>(url)) ?? { items: [] };
}

export function espnEventIdFromMatchId(matchId: string): string | null {
  if (!matchId.startsWith("espn-")) return null;
  return matchId.slice(5) || null;
}
