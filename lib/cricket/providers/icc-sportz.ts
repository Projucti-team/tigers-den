import type { CricketFormat, Gender, GenderRankings, RankedPlayer, RankedTeam } from "@/lib/cricket/types";
import {
  FORMATS,
  FORMATS_BY_GENDER,
  RANKINGS_PLAYER_DEPTH,
  isBangladeshTeam,
  topBangladeshPlayer,
} from "@/lib/cricket/constants";

/** Public JSON feed used by https://www.icc-cricket.com/rankings */
const ICC_SPORTZ_BASE = "https://assets-icc.sportz.io/cricket/v1/ranking";
/** Raw client_id — URLSearchParams encodes it once */
const ICC_SPORTZ_CLIENT_ID = "tPZJbRgIub3Vua93/DWtyQ==";

type RankingType = "team" | "bat" | "bowl" | "allrounder";

type SportzRankRow = Record<string, string>;

type SportzResponse = {
  data?: {
    "bat-rank"?: {
      last_updated?: string;
      "rank-type"?: string;
      rank_date?: string;
      rank?: SportzRankRow[];
    };
  };
};

const MEN_COMP: Record<CricketFormat, string> = {
  test: "test",
  odi: "odi",
  t20: "t20",
};

/** ICC uses separate comp_type codes for women's limited-overs formats */
const WOMEN_COMP: Partial<Record<CricketFormat, string>> = {
  odi: "odiw",
  t20: "t20w",
};

function compTypeFor(gender: Gender, format: CricketFormat): string | null {
  if (gender === "men") return MEN_COMP[format];
  return WOMEN_COMP[format] ?? null;
}

function buildUrl(compType: string, type: RankingType): string {
  const url = new URL(ICC_SPORTZ_BASE);
  url.searchParams.set("client_id", ICC_SPORTZ_CLIENT_ID);
  url.searchParams.set("comp_type", compType);
  url.searchParams.set("feed_format", "json");
  url.searchParams.set("lang", "en");
  url.searchParams.set("type", type);
  return url.toString();
}

type SportzFeed = {
  rows: SportzRankRow[];
  /** ICC's "rank_date" (YYYY-MM-DD) — when this ranking table was last updated. */
  rankDate: string | null;
};

async function fetchSportz(compType: string, type: RankingType): Promise<SportzFeed> {
  try {
    const res = await fetch(buildUrl(compType, type), {
      signal: AbortSignal.timeout(15000),
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return { rows: [], rankDate: null };
    const json = (await res.json()) as SportzResponse;
    const block = json.data?.["bat-rank"];
    return {
      rows: block?.rank ?? [],
      rankDate: block?.rank_date?.trim() || block?.last_updated?.trim() || null,
    };
  } catch {
    return { rows: [], rankDate: null };
  }
}

/** ICC tied ranks use no="=" (same position as the previous numeric rank). */
function parseIccRank(
  no: string | undefined,
  previousRank: number,
): { rank: number; tied: boolean } {
  const raw = (no ?? "").trim();
  const parsed = Number.parseInt(raw, 10);
  if (Number.isFinite(parsed) && parsed > 0) {
    return { rank: parsed, tied: false };
  }
  if (raw === "=") {
    return { rank: previousRank > 0 ? previousRank : 1, tied: true };
  }
  return { rank: 0, tied: false };
}

function mapTeams(rows: SportzRankRow[]): RankedTeam[] {
  let prevRank = 0;
  return rows
    .map((row) => {
      const { rank, tied } = parseIccRank(row.no, prevRank);
      if (rank > 0 && !tied) prevRank = rank;
      else if (rank > 0 && tied && prevRank === 0) prevRank = rank;
      const rating = Number.parseFloat(row.Rating ?? "0");
      const points = Number.parseFloat(row.Points ?? "0");
      const matches = Number.parseInt(row.Matches ?? "0", 10);
      return {
        rank,
        name: row.Country ?? row.team_name ?? "",
        abbreviation: row.shortname ?? row.Country ?? "",
        rating: Number.isFinite(rating) ? rating : 0,
        points: Number.isFinite(points) ? points : undefined,
        matches: Number.isFinite(matches) && matches > 0 ? matches : undefined,
      };
    })
    .filter((t) => t.rank > 0 && t.name)
    .sort((a, b) => a.rank - b.rank);
}

function mapPlayers(rows: SportzRankRow[]): RankedPlayer[] {
  let prevRank = 0;
  return rows
    .map((row) => {
      const { rank, tied } = parseIccRank(row.no, prevRank);
      if (rank > 0 && !tied) prevRank = rank;
      else if (rank > 0 && tied && prevRank === 0) prevRank = rank;

      const rating = Number.parseFloat(row.Points ?? row.Rating ?? "0");
      const iccPlayerId = row.Player_id?.trim() || undefined;
      const profileUrl = row.Player_url?.trim() || undefined;

      return {
        rank,
        rankTied: tied || undefined,
        name: row["Player-name"] ?? "",
        team: row.team_name ?? row.Country_name ?? row.Country ?? "",
        rating: Number.isFinite(rating) ? rating : 0,
        points: Number.isFinite(rating) ? rating : undefined,
        iccPlayerId,
        profileUrl,
        imageUrl: iccPlayerId
          ? `https://images.icc-cricket.com/image/upload/t_player-headshot-portrait-lg-webp/prd/assets/players/generic/colored/${iccPlayerId}.png`
          : undefined,
      };
    })
    .filter((p) => p.rank > 0 && p.name)
    .sort((a, b) => a.rank - b.rank);
}

function findBangladesh(teams: RankedTeam[]): RankedTeam | null {
  return (
    teams.find(
      (t) =>
        isBangladeshTeam(t.name) ||
        isBangladeshTeam(t.abbreviation) ||
        t.abbreviation.toUpperCase() === "BAN" ||
        t.abbreviation.toUpperCase() === "BD",
    ) ?? null
  );
}

export type IccRankingsSnapshot = {
  fetchedAt: string;
  source: "icc-sportz.io";
  sourceUrl: "https://www.icc-cricket.com/rankings";
  men: GenderRankings;
  women: GenderRankings;
};

const emptyFormatPlayers = (format: CricketFormat) => ({
  format,
  topBatsmen: [],
  topBowlers: [],
  topAllRounders: [],
  topBangladeshBatsman: null,
  topBangladeshBowler: null,
  topBangladeshAllRounder: null,
});

async function buildGenderRankings(gender: Gender): Promise<GenderRankings> {
  const teams = {} as GenderRankings["teams"];
  const bangladesh = {} as GenderRankings["bangladesh"];
  const players = {} as GenderRankings["players"];
  const rankUpdatedAt = {} as NonNullable<GenderRankings["rankUpdatedAt"]>;

  for (const format of FORMATS) {
    teams[format] = [];
    bangladesh[format] = null;
    players[format] = emptyFormatPlayers(format);
    rankUpdatedAt[format] = null;
  }

  for (const format of FORMATS_BY_GENDER[gender]) {
    const compType = compTypeFor(gender, format);
    if (!compType) continue;

    const [teamFeed, batFeed, bowlFeed, arFeed] = await Promise.all([
      fetchSportz(compType, "team"),
      fetchSportz(compType, "bat"),
      fetchSportz(compType, "bowl"),
      fetchSportz(compType, "allrounder"),
    ]);

    // Most recent rank_date across the four tables (YYYY-MM-DD sorts lexicographically).
    rankUpdatedAt[format] =
      [teamFeed, batFeed, bowlFeed, arFeed]
        .map((f) => f.rankDate)
        .filter((d): d is string => Boolean(d))
        .sort()
        .pop() ?? null;

    const teamList = mapTeams(teamFeed.rows);
    const batsmen = mapPlayers(batFeed.rows);
    const bowlers = mapPlayers(bowlFeed.rows);
    const allRounders = mapPlayers(arFeed.rows);

    teams[format] = teamList;
    bangladesh[format] = findBangladesh(teamList);
    players[format] = {
      format,
      topBatsmen: batsmen.slice(0, RANKINGS_PLAYER_DEPTH),
      topBowlers: bowlers.slice(0, RANKINGS_PLAYER_DEPTH),
      topAllRounders: allRounders.slice(0, RANKINGS_PLAYER_DEPTH),
      topBangladeshBatsman: topBangladeshPlayer(batsmen),
      topBangladeshBowler: topBangladeshPlayer(bowlers),
      topBangladeshAllRounder: topBangladeshPlayer(allRounders),
    };
  }

  return { gender, teams, bangladesh, players, rankUpdatedAt };
}

/** Fetch all ICC rankings from the Sportz.io feed (same data as icc-cricket.com). */
export async function fetchAllIccRankingsFromSportz(): Promise<IccRankingsSnapshot> {
  const [men, women] = await Promise.all([
    buildGenderRankings("men"),
    buildGenderRankings("women"),
  ]);

  return {
    fetchedAt: new Date().toISOString(),
    source: "icc-sportz.io",
    sourceUrl: "https://www.icc-cricket.com/rankings",
    men,
    women,
  };
}
