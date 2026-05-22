import { SPORTS_JUPITER_BASE } from "@/lib/cricket/constants";
import type { CricketFormat, Gender, RankedPlayer, RankedTeam } from "@/lib/cricket/types";

function getToken(): string | null {
  return process.env.CRICKET_JUPITER_API_TOKEN || null;
}

async function jupiterFetch<T>(
  path: string,
  params: Record<string, string>,
): Promise<T | null> {
  const token = getToken();
  if (!token) return null;

  try {
    const url = new URL(`${SPORTS_JUPITER_BASE}${path}`);
    url.searchParams.set("api_token", token);
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }

    const res = await fetch(url.toString(), {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) return null;
    const json = await res.json();
    return json as T;
  } catch {
    return null;
  }
}

type JupiterTeamResponse = {
  data?: {
    rankings?: {
      format?: string;
      teams?: {
        position: number;
        name: string;
        code: string;
        rating: number;
        points: number;
        matches: number;
      }[];
    }[];
  };
};

type JupiterPlayerResponse = {
  data?: {
    rankings?: {
      format?: string;
      players?: {
        position: number;
        name: string;
        team: { name: string; code?: string };
        rating: number;
        role?: string;
      }[];
    }[];
  };
};

const FORMAT_MAP: Record<string, CricketFormat> = {
  test: "test",
  odi: "odi",
  t20: "t20",
  t20i: "t20",
};

export async function fetchJupiterTeamRankings(
  gender: Gender,
  format: CricketFormat,
): Promise<RankedTeam[] | null> {
  const raw = await jupiterFetch<JupiterTeamResponse>("/team-rankings", {
    category: gender === "women" ? "women" : "men",
  });

  const block = raw?.data?.rankings?.find(
    (r) => FORMAT_MAP[String(r.format || "").toLowerCase()] === format,
  );

  if (!block?.teams) return null;

  return block.teams.map((t) => ({
    rank: t.position,
    name: t.name,
    abbreviation: t.code,
    rating: t.rating,
    points: t.points,
    matches: t.matches,
  }));
}

export async function fetchJupiterPlayerRankings(
  gender: Gender,
  format: CricketFormat,
  role: "bat" | "bowl",
): Promise<RankedPlayer[] | null> {
  const raw = await jupiterFetch<JupiterPlayerResponse>("/player-rankings", {
    category: gender === "women" ? "women" : "men",
    role,
    format,
  });

  const block = raw?.data?.rankings?.find(
    (r) => FORMAT_MAP[String(r.format || "").toLowerCase()] === format,
  );

  if (!block?.players) return null;

  return block.players.map((p) => ({
    rank: p.position,
    name: p.name,
    team: p.team?.name || p.team?.code || "",
    rating: p.rating,
  }));
}

export function isJupiterConfigured(): boolean {
  return Boolean(getToken());
}
