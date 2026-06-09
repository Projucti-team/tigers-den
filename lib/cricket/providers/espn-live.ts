import { readFile } from "node:fs/promises";
import path from "node:path";

import { isBangladeshTeam } from "@/lib/cricket/constants";
import { compactCricketScore } from "@/lib/cricket/score-format";
import { teamShortCode } from "@/lib/cricket/services/marquee-format";
import { readEspnTourSquads } from "@/lib/cricket/squads/store";
import type { MatchHighlight } from "@/lib/cricket/services/match-highlight";

const CORE_BASE = "http://core.espnuk.org/v2/sports/cricket";
const FIXTURE_TIMES_PATH = path.join(process.cwd(), "data", "espn-fixture-times.json");

const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const LIVE_CACHE_MS = 45_000;

type CoreList = { items?: { $ref: string }[] };

type CoreCompetition = {
  id?: string;
  liveAvailable?: boolean;
  note?: string;
  description?: string;
  shortDescription?: string;
  status?: { $ref: string };
};

type CoreStatus = {
  type?: { state?: string; description?: string; detail?: string };
  summary?: string;
  longSummary?: string;
};

type CoreScore = {
  value?: string;
  displayValue?: string;
  innings?: string;
};

type CoreTeam = {
  displayName?: string;
  abbreviation?: string;
};

type LeagueRef = {
  espnLeagueId: number;
  cricinfoSeriesId?: number;
};

let liveCache: { at: number; highlight: MatchHighlight | null } | null = null;

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

async function trackedLeagues(): Promise<LeagueRef[]> {
  const byId = new Map<number, LeagueRef>();

  const squads = await readEspnTourSquads();
  for (const entry of Object.values(squads.entries)) {
    if (entry.espnLeagueId) {
      byId.set(entry.espnLeagueId, {
        espnLeagueId: entry.espnLeagueId,
        cricinfoSeriesId: entry.cricinfoSeriesId,
      });
    }
  }

  try {
    const raw = await readFile(FIXTURE_TIMES_PATH, "utf8");
    const data = JSON.parse(raw) as {
      series?: Record<string, { espnLeagueId?: number; cricinfoSeriesId?: number }>;
    };
    for (const series of Object.values(data.series ?? {})) {
      if (series.espnLeagueId) {
        byId.set(series.espnLeagueId, {
          espnLeagueId: series.espnLeagueId,
          cricinfoSeriesId: series.cricinfoSeriesId,
        });
      }
    }
  } catch {
    // optional file
  }

  if (!byId.size) {
    byId.set(24324, { espnLeagueId: 24324, cricinfoSeriesId: 1532475 });
  }

  return [...byId.values()];
}

function isLiveStatus(status: CoreStatus | null, competition: CoreCompetition): boolean {
  const state = status?.type?.state?.toLowerCase();
  const detail = status?.type?.description?.toLowerCase() ?? "";
  if (state === "in" || detail === "live") return true;
  if (competition.liveAvailable && state !== "post" && state !== "pre") {
    const note = competition.note ?? status?.longSummary ?? "";
    if (/overs remaining|require.*runs|in progress|stumps|lunch|tea/i.test(note)) {
      return true;
    }
  }
  return false;
}

async function fetchCompetitorScore(
  compRef: string,
): Promise<{ team: string; score: string } | null> {
  const comp = await fetchCoreJson<{
    team?: { $ref: string };
    score?: { $ref: string };
  }>(compRef);
  if (!comp?.team?.$ref) return null;

  const team = await fetchCoreJson<CoreTeam>(comp.team.$ref);
  const label = team?.displayName ?? team?.abbreviation ?? "Team";

  let scoreText = "";
  if (comp.score?.$ref) {
    const score = await fetchCoreJson<CoreScore>(comp.score.$ref);
    scoreText = score?.displayValue ?? score?.value ?? "";
  }

  return { team: label, score: scoreText };
}

async function buildHighlightFromEspnEvent(
  leagueId: number,
  eventId: string,
): Promise<MatchHighlight | null> {
  const competition = await fetchCoreJson<CoreCompetition>(
    `${CORE_BASE}/leagues/${leagueId}/events/${eventId}/competitions/${eventId}`,
  );
  if (!competition) return null;

  const status = competition.status?.$ref
    ? await fetchCoreJson<CoreStatus>(competition.status.$ref)
    : null;

  if (!isLiveStatus(status, competition)) return null;

  const competitors = await fetchCoreList(
    `${CORE_BASE}/leagues/${leagueId}/events/${eventId}/competitions/${eventId}/competitors`,
  );

  const innings = (
    await Promise.all(
      (competitors.items ?? []).map((item) => fetchCompetitorScore(item.$ref)),
    )
  ).filter((row): row is { team: string; score: string } => Boolean(row?.score));

  const involvesBd =
    innings.some((inn) => isBangladeshTeam(inn.team)) ||
    /bangladesh/i.test(competition.note ?? "");

  if (!involvesBd && innings.length >= 2) {
    const event = await fetchCoreJson<{ name?: string; shortName?: string }>(
      `${CORE_BASE}/leagues/${leagueId}/events/${eventId}`,
    );
    const blob = `${event?.name ?? ""} ${event?.shortName ?? ""}`.toLowerCase();
    if (!blob.includes("bangladesh") && !blob.includes("ban")) return null;
  } else if (!involvesBd) {
    return null;
  }

  const bd = innings.find((inn) => isBangladeshTeam(inn.team));
  const other = innings.find((inn) => !isBangladeshTeam(inn.team));

  const scores = innings.map((inn) => {
    const chasing =
      /\d+\s*ov|target\s+\d+/i.test(inn.score) && !/^\d+\/\d+$/.test(inn.score.trim());
    return {
      label: inn.team,
      value: compactCricketScore(inn.score, !chasing),
    };
  });

  const bdScore = scores.find((s) => isBangladeshTeam(s.label));
  const otherScore = scores.find((s) => !isBangladeshTeam(s.label));
  const scoreLine =
    bdScore && otherScore
      ? `${teamShortCode(bdScore.label)} ${bdScore.value} · ${teamShortCode(otherScore.label)} ${otherScore.value}`
      : scores.map((s) => `${teamShortCode(s.label)} ${s.value}`).join(" · ");

  const title =
    competition.shortDescription?.trim() ||
    competition.description?.trim() ||
    `Bangladesh match · Event ${eventId}`;

  const detailLine =
    status?.longSummary ?? status?.summary ?? competition.note ?? "Live on ESPNcricinfo";

  return {
    mode: "live",
    matchId: `espn-${eventId}`,
    title,
    scoreLine,
    detailLine,
    scores,
  };
}

/** Live Bangladesh internationals from ESPNcricinfo (no CricAPI quota). */
export async function fetchEspnLiveBangladeshHighlight(): Promise<MatchHighlight | null> {
  if (liveCache && Date.now() - liveCache.at < LIVE_CACHE_MS) {
    return liveCache.highlight;
  }

  const leagues = await trackedLeagues();

  for (const league of leagues) {
    const leagueIds = [league.espnLeagueId, league.cricinfoSeriesId].filter(
      (id): id is number => Number.isFinite(id),
    );
    const seenEvents = new Set<string>();

    for (const leagueId of leagueIds) {
      const events = await fetchCoreList(
        `${CORE_BASE}/leagues/${leagueId}/events?pageSize=50`,
      );

      for (const item of events.items ?? []) {
        const eventId = eventIdFromRef(item.$ref);
        if (!eventId || seenEvents.has(eventId)) continue;
        seenEvents.add(eventId);

        const highlight = await buildHighlightFromEspnEvent(league.espnLeagueId, eventId);
        if (highlight) {
          liveCache = { at: Date.now(), highlight };
          return highlight;
        }
      }
    }
  }

  liveCache = { at: Date.now(), highlight: null };
  return null;
}
