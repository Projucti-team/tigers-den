import { isBangladeshTeam } from "@/lib/cricket/constants";
import { ESPN_BROWSER_USER_AGENT } from "@/lib/cricket/providers/espn-core";
import type {
  ScorecardAward,
  ScorecardExtras,
  ScorecardImpactPlayer,
  ScorecardRecordNote,
} from "@/lib/cricket/types";

const CRICINFO_ORIGIN = "https://www.espncricinfo.com";
const EXTRAS_CACHE_MS = 5 * 60 * 1000;

type CricinfoTeam = {
  name?: string;
  longName?: string;
  abbreviation?: string;
};

type CricinfoPlayer = {
  longName?: string;
  name?: string;
  battingName?: string;
};

type InningStatRow = {
  stat?: {
    runs?: number | null;
    ballsFaced?: number | null;
    notouts?: number | null;
    wickets?: number | null;
    conceded?: number | null;
  };
};

type MatchPlayerAward = {
  type?: string;
  player?: CricinfoPlayer;
  team?: CricinfoTeam;
  inningStats?: InningStatRow[];
};

type SmartScorecardPlayer = {
  player?: CricinfoPlayer;
  team?: CricinfoTeam;
  totalImpact?: number;
  battingImpact?: number;
  bowlingImpact?: number;
};

type DebutPlayerRow = {
  player?: CricinfoPlayer;
  team?: CricinfoTeam;
  classId?: number;
};

type CricinfoMatchPage = {
  match?: {
    debutPlayers?: DebutPlayerRow[];
    format?: string;
  };
  content?: {
    matchPlayerAwards?: MatchPlayerAward[];
    milestones?: unknown[];
    smartScorecard?: {
      playerStats?: SmartScorecardPlayer[];
    };
    supportInfo?: {
      mostValuedPlayerOfTheMatch?: SmartScorecardPlayer;
    };
  };
};

const extrasCache = new Map<string, { at: number; data: ScorecardExtras | null }>();

const CLASS_LABEL: Record<number, string> = {
  1: "Test",
  2: "ODI",
  3: "T20I",
};

function playerName(player?: CricinfoPlayer): string {
  return player?.longName?.trim() || player?.battingName?.trim() || player?.name?.trim() || "";
}

function teamLabel(team?: CricinfoTeam): string | undefined {
  return team?.abbreviation?.trim() || team?.name?.trim() || team?.longName?.trim() || undefined;
}

function isBangladeshSide(team?: CricinfoTeam): boolean {
  const blob = `${team?.name ?? ""} ${team?.longName ?? ""} ${team?.abbreviation ?? ""}`;
  return isBangladeshTeam(blob);
}

function formatAwardStats(rows?: InningStatRow[]): string | undefined {
  if (!rows?.length) return undefined;

  const batParts: string[] = [];
  const bowlParts: string[] = [];

  for (const row of rows) {
    const stat = row.stat;
    if (!stat) continue;

    if (stat.runs != null && stat.ballsFaced != null) {
      const runs = stat.notouts ? `${stat.runs}*` : String(stat.runs);
      batParts.push(`${runs} (${stat.ballsFaced})`);
    }

    if (stat.wickets != null) {
      bowlParts.push(`${stat.wickets}/${stat.conceded ?? "?"}`);
    }
  }

  const parts = [...batParts, ...bowlParts];
  return parts.length ? parts.join(" & ") : undefined;
}

function mapImpactPlayer(row?: SmartScorecardPlayer | null): ScorecardImpactPlayer | undefined {
  if (!row) return undefined;
  const name = playerName(row.player);
  if (!name || row.totalImpact == null) return undefined;

  return {
    name,
    team: teamLabel(row.team),
    impactPoints: Math.round(row.totalImpact * 100) / 100,
    battingImpact:
      row.battingImpact != null ? Math.round(row.battingImpact * 100) / 100 : undefined,
    bowlingImpact:
      row.bowlingImpact != null ? Math.round(row.bowlingImpact * 100) / 100 : undefined,
  };
}

function formatMilestone(entry: unknown): ScorecardRecordNote | null {
  if (typeof entry === "string" && entry.trim()) {
    return { text: entry.trim() };
  }

  if (!entry || typeof entry !== "object") return null;
  const row = entry as Record<string, unknown>;

  for (const key of ["description", "text", "title", "summary", "name"]) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) {
      const player =
        typeof row.player === "object" && row.player
          ? playerName(row.player as CricinfoPlayer)
          : typeof row.playerName === "string"
            ? row.playerName
            : undefined;
      return { text: value.trim(), player: player || undefined };
    }
  }

  return null;
}

function debutNotes(debuts?: DebutPlayerRow[], format?: string): ScorecardRecordNote[] {
  if (!debuts?.length) return [];

  return debuts
    .map((row) => {
      const name = playerName(row.player);
      if (!name) return null;
      const formatLabel = CLASS_LABEL[row.classId ?? -1] ?? format?.toUpperCase() ?? "International";
      const team = teamLabel(row.team);
      const text = team ? `${name} (${team}) — ${formatLabel} debut` : `${name} — ${formatLabel} debut`;
      return { text, player: name };
    })
    .filter((row): row is ScorecardRecordNote => Boolean(row));
}

function topBangladeshImpact(players?: SmartScorecardPlayer[]): ScorecardImpactPlayer | undefined {
  const ranked = (players ?? [])
    .filter((row) => isBangladeshSide(row.team))
    .map((row) => mapImpactPlayer(row))
    .filter((row): row is ScorecardImpactPlayer => Boolean(row))
    .sort((a, b) => b.impactPoints - a.impactPoints);

  return ranked[0];
}

function parseCricinfoMatchPage(payload: CricinfoMatchPage): ScorecardExtras {
  const records: ScorecardRecordNote[] = [];
  const awards = payload.content?.matchPlayerAwards ?? [];
  const potmAward = awards.find((row) => row.type === "PLAYER_OF_MATCH");

  let manOfTheMatch: ScorecardAward | undefined;
  if (potmAward) {
    const name = playerName(potmAward.player);
    if (name) {
      manOfTheMatch = {
        name,
        team: teamLabel(potmAward.team),
        summary: formatAwardStats(potmAward.inningStats),
      };
    }
  }

  for (const milestone of payload.content?.milestones ?? []) {
    const note = formatMilestone(milestone);
    if (note) records.push(note);
  }

  records.push(...debutNotes(payload.match?.debutPlayers, payload.match?.format));

  const mvp =
    mapImpactPlayer(payload.content?.supportInfo?.mostValuedPlayerOfTheMatch) ??
    mapImpactPlayer(
      [...(payload.content?.smartScorecard?.playerStats ?? [])].sort(
        (a, b) => (b.totalImpact ?? 0) - (a.totalImpact ?? 0),
      )[0],
    );

  const topBangladeshPlayer = topBangladeshImpact(payload.content?.smartScorecard?.playerStats);

  return {
    manOfTheMatch,
    mvp,
    records,
    topBangladeshPlayer,
  };
}

function extractCricinfoPagePayload(raw: unknown): CricinfoMatchPage | null {
  if (!raw || typeof raw !== "object") return null;
  const root = raw as Record<string, unknown>;
  const appPageProps = root.props as { appPageProps?: { data?: { data?: CricinfoMatchPage } } } | undefined;
  const nested = appPageProps?.appPageProps?.data?.data;
  if (nested?.content || nested?.match) return nested;
  return null;
}

export async function fetchCricinfoScorecardExtras(
  seriesId: string,
  matchId: string,
): Promise<ScorecardExtras | null> {
  const cacheKey = `${seriesId}:${matchId}`;
  const cached = extrasCache.get(cacheKey);
  if (cached && Date.now() - cached.at < EXTRAS_CACHE_MS) {
    return cached.data;
  }

  const url = `${CRICINFO_ORIGIN}/series/series-${seriesId}/match-${matchId}/live-cricket-score`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": ESPN_BROWSER_USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
        Referer: `${CRICINFO_ORIGIN}/`,
      },
      signal: AbortSignal.timeout(18_000),
      cache: "no-store",
    });
    if (!res.ok) {
      extrasCache.set(cacheKey, { at: Date.now(), data: null });
      return null;
    }

    const html = await res.text();
    const match = html.match(/<script[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/);
    if (!match) {
      extrasCache.set(cacheKey, { at: Date.now(), data: null });
      return null;
    }

    const parsed = extractCricinfoPagePayload(JSON.parse(match[1]));
    if (!parsed) {
      extrasCache.set(cacheKey, { at: Date.now(), data: null });
      return null;
    }

    const extras = parseCricinfoMatchPage(parsed);
    const hasContent =
      extras.manOfTheMatch ||
      extras.mvp ||
      extras.topBangladeshPlayer ||
      extras.records.length > 0;

    const data = hasContent ? extras : null;
    extrasCache.set(cacheKey, { at: Date.now(), data });
    return data;
  } catch {
    extrasCache.set(cacheKey, { at: Date.now(), data: null });
    return null;
  }
}

/** Cricinfo series id embedded in ESPN event refs (e.g. 1532475). */
export function cricinfoSeriesIdFromEventRef(eventRef?: string): string | null {
  const match = eventRef?.match(/\/leagues\/(\d{6,})\/events\//);
  return match?.[1] ?? null;
}
