import { ICC_RANKINGS_BASE } from "@/lib/cricket/constants";
import type { CricketFormat, RankedPlayer } from "@/lib/cricket/types";

type IccFormatBlock = {
  format: string;
  data: {
    name: string;
    team?: string;
    team_name?: string;
    team_abbreviation?: string;
    rank: number;
    rating: number;
    points?: number;
    matches?: number;
  }[];
};

async function fetchIcc<T>(path: string, format?: CricketFormat): Promise<T | null> {
  try {
    const url = new URL(`${ICC_RANKINGS_BASE}${path}`);
    if (format) url.searchParams.set("format", format);

    const res = await fetch(url.toString(), {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function pickFormatBlock(blocks: IccFormatBlock[] | null, format: CricketFormat) {
  if (!blocks) return [];
  const block = blocks.find((b) => b.format === format);
  return block?.data ?? [];
}

export async function fetchIccTeamRankings(format: CricketFormat) {
  const data = await fetchIcc<IccFormatBlock[]>("/teams", format);
  return pickFormatBlock(data, format).map((t) => ({
    rank: t.rank,
    name: t.team_name || "",
    abbreviation: t.team_abbreviation || "",
    rating: t.rating,
    points: t.points,
    matches: t.matches,
  }));
}

export async function fetchIccPlayerRankings(
  role: "batsmen" | "bowlers",
  format: CricketFormat,
): Promise<RankedPlayer[]> {
  const data = await fetchIcc<IccFormatBlock[]>(`/${role}`, format);
  return pickFormatBlock(data, format).map((p) => ({
    rank: p.rank,
    name: p.name,
    team: p.team || p.team_abbreviation || "",
    rating: p.rating,
    points: p.points,
  }));
}

export function isIccRankingsAvailable(): boolean {
  return true;
}
