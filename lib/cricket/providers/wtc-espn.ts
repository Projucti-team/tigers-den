import type { WtcStandingsSnapshot, WtcTeamStanding } from "@/lib/cricket/types";

/** ICC World Test Championship 2025–27 on ESPN Cricinfo */
const WTC_LEAGUE_ID = 1472510;
const WTC_SEASON_YEAR = 2025;
const STANDINGS_URL = `http://core.espnuk.org/v2/sports/cricket/leagues/${WTC_LEAGUE_ID}/seasons/${WTC_SEASON_YEAR}/types/1/groups/1/standings/1`;

const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

type CoreStat = { name: string; value?: number; displayValue?: string };

type CoreStandingRow = {
  team: { $ref: string };
  records: { stats: CoreStat[] }[];
};

type CoreStandingsResponse = {
  displayName?: string;
  standings?: CoreStandingRow[];
};

type CoreTeam = {
  id?: string;
  displayName?: string;
  name?: string;
  abbreviation?: string;
};

function statNumber(stats: CoreStat[], name: string): number {
  const row = stats.find((s) => s.name === name);
  const raw = row?.value ?? Number.parseFloat(row?.displayValue ?? "0");
  return Number.isFinite(raw) ? raw : 0;
}

/** WTC points percentage: points ÷ (matches × 12) × 100 */
export function wtcPointsPercentage(points: number, matchesPlayed: number): number {
  if (matchesPlayed <= 0) return 0;
  return Math.round((points / (matchesPlayed * 12)) * 10000) / 100;
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": BROWSER_USER_AGENT },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/**
 * Resolves a team $ref to its display name. Returns null (rather than a placeholder like
 * "Unknown") when ESPN's team lookup fails, so the caller can drop the row instead of showing
 * a bogus team in the table.
 */
async function resolveTeam(ref: string): Promise<{ name: string; abbreviation: string } | null> {
  const team = await fetchJson<CoreTeam>(ref);
  const name = team?.displayName ?? team?.name ?? null;
  if (!name) return null;
  return {
    name,
    abbreviation: team?.abbreviation ?? "",
  };
}

function mapRow(
  row: CoreStandingRow,
  team: { name: string; abbreviation: string },
): WtcTeamStanding | null {
  const stats = row.records?.[0]?.stats;
  if (!stats?.length) return null;

  const rank = statNumber(stats, "rank");
  if (rank <= 0) return null;

  const played = statNumber(stats, "matchesPlayed");
  const points = statNumber(stats, "matchPoints");

  return {
    rank,
    team: team.name,
    abbreviation: team.abbreviation,
    played,
    won: statNumber(stats, "matchesWon"),
    lost: statNumber(stats, "matchesLost"),
    drawn: statNumber(stats, "matchesDraw"),
    tied: statNumber(stats, "matchesTied"),
    noResult: statNumber(stats, "noresult"),
    points,
    pct: wtcPointsPercentage(points, played),
  };
}

/** Fetch WTC table from ESPN core API (same standings as Cricinfo player profiles site). */
export async function fetchWtcStandingsFromEspn(): Promise<WtcStandingsSnapshot> {
  const data = await fetchJson<CoreStandingsResponse>(STANDINGS_URL);
  const rows = data?.standings ?? [];

  const mapped = await Promise.all(
    rows.map(async (row) => {
      const ref = row.team?.$ref;
      if (!ref) return null;
      const team = await resolveTeam(ref);
      if (!team) return null;
      return mapRow(row, team);
    }),
  );

  // The official WTC table is ordered by points percentage (PCT), not raw ESPN "rank" or raw
  // points -- teams play different numbers of matches, so points alone isn't comparable. Sort
  // by pct here and derive the displayed rank from that order, rather than trusting whatever
  // "rank" stat ESPN's core API happens to return for each row.
  const standings = mapped
    .filter((r): r is WtcTeamStanding => r != null)
    .sort((a, b) => b.pct - a.pct)
    .map((team, index) => ({ ...team, rank: index + 1 }));

  return {
    fetchedAt: new Date().toISOString(),
    source: "espn-cricinfo-core",
    cycleLabel: "2025–2027",
    standings,
  };
}
