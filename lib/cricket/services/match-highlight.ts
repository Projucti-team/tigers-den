import { isBangladeshTeam } from "@/lib/cricket/constants";
import { fetchScorecard, isCricApiConfigured } from "@/lib/cricket/providers/cricapi";
import { fetchEspnMatchCentre } from "@/lib/cricket/providers/espn-match-centre";
import { getCityWeather, type MatchWeather } from "@/lib/cricket/providers/weather";
import type { LiveMatchFeed } from "@/lib/cricket/types";
import {
  getLiveBangladeshHighlight,
  getRecentBangladeshMatchHighlight,
} from "@/lib/cricket/services/bangladesh-last-match";
import type { LiveMatchSummary, Scorecard } from "@/lib/cricket/types";

export type MatchHighlight = {
  mode: "live" | "completed";
  matchId: string;
  title: string;
  scoreLine: string;
  detailLine: string;
  scores: { label: string; value: string }[];
  venue?: { name?: string; city?: string; country?: string };
};

export function involvesBangladesh(match: LiveMatchSummary): boolean {
  const teams = match.teams || match.teamInfo?.map((t) => t.name) || [];
  if (teams.some((t) => isBangladeshTeam(t))) return true;
  const blob = `${match.name} ${teams.join(" ")}`.toLowerCase();
  return blob.includes("bangladesh") || blob.includes(" ban ") || blob.includes("ban vs");
}

export function isActuallyLive(match: LiveMatchSummary): boolean {
  if (!match.isLive) return false;
  const status = match.status.toLowerCase();
  if (/completed|finished|won|lost|draw|abandon|no result|stump day/i.test(status)) {
    return false;
  }
  return /live|in progress|innings|stumps|lunch|tea|drinks|rain delay|super over/i.test(
    status,
  );
}

export function isCompletedMatch(match: LiveMatchSummary): boolean {
  if (isActuallyLive(match)) return false;
  const status = match.status.toLowerCase();
  if (/not started|upcoming|fixture|scheduled|match starts in/i.test(status)) {
    return false;
  }
  if (
    /won|lost|beat|draw|tied|completed|finished|defeat|no result|abandon|margin/i.test(status)
  ) {
    return true;
  }

  const playedAt = matchTime(match);
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  if (playedAt > 0 && playedAt < oneHourAgo && (match.score?.length ?? 0) >= 1) {
    return true;
  }

  return false;
}

export function matchTime(match: LiveMatchSummary): number {
  const raw = match.dateTimeGMT || match.date;
  const t = raw ? new Date(raw).getTime() : 0;
  return Number.isNaN(t) ? 0 : t;
}

function formatInningsScores(match: LiveMatchSummary): { label: string; value: string }[] {
  if (!match.score?.length) return [];

  return match.score.map((inn, i) => {
    const label = inn.inning?.replace(/Inning\s*/i, "").trim() || `Innings ${i + 1}`;
    const short =
      label.length > 20 ? label.replace(/Inning\s*/i, "").slice(0, 18) : label;
    return {
      label: short,
      value: `${inn.r}/${inn.w} (${inn.o} ov)`,
    };
  });
}

function formatBangladeshScoreLine(match: LiveMatchSummary): string {
  const scores = formatInningsScores(match);
  const bdInning = match.score?.find((s) => isBangladeshTeam(s.inning ?? ""));
  if (bdInning) {
    const others = match.score?.filter((s) => s !== bdInning) ?? [];
    const bd = `BAN ${bdInning.r}/${bdInning.w}`;
    if (others.length) {
      const o = others[others.length - 1];
      return `${bd} · ${o.r}/${o.w}`;
    }
    return bd;
  }

  if (scores.length >= 2) {
    return scores
      .slice(0, 4)
      .map((s) => s.value)
      .join(" · ");
  }
  if (scores.length === 1) return scores[0].value;
  return match.status;
}

export function matchToHighlight(
  match: LiveMatchSummary,
  mode: "live" | "completed",
): MatchHighlight {
  // CricAPI venue strings look like "Shere Bangla National Stadium, Dhaka".
  const venueParts = (match.venue ?? "").split(",").map((p) => p.trim()).filter(Boolean);
  const venue = venueParts.length
    ? { name: match.venue, city: venueParts[venueParts.length - 1] }
    : undefined;

  return {
    mode,
    matchId: match.id,
    title: match.name,
    scoreLine: formatBangladeshScoreLine(match),
    detailLine: match.status,
    scores: formatInningsScores(match),
    venue,
  };
}

export function findLiveBangladeshMatch(matches: LiveMatchSummary[]): LiveMatchSummary | null {
  return matches.find((m) => involvesBangladesh(m) && isActuallyLive(m)) ?? null;
}

/** Most recent Bangladesh match with a result (completed or scored). */
export function findLastBangladeshMatch(matches: LiveMatchSummary[]): LiveMatchSummary | null {
  const candidates = matches
    .filter((m) => involvesBangladesh(m) && isCompletedMatch(m))
    .sort((a, b) => matchTime(b) - matchTime(a));

  return candidates[0] ?? null;
}

/** Live from ESPN/CricAPI; otherwise the most recent completed match (ESPN first). */
export async function getMatchHighlight(): Promise<MatchHighlight | null> {
  const live = await getLiveBangladeshHighlight();
  if (live) return live;

  return getRecentBangladeshMatchHighlight();
}

/** Current weather at the match venue — live matches only. */
async function getHighlightWeather(
  highlight: MatchHighlight,
): Promise<MatchWeather | null> {
  if (highlight.mode !== "live" || !highlight.venue?.city) return null;
  return getCityWeather(highlight.venue.city, highlight.venue.country).catch(() => null);
}

export async function getMatchCentreData(): Promise<{
  highlight: MatchHighlight | null;
  scorecard: Scorecard | null;
  liveFeed: LiveMatchFeed | null;
  weather: MatchWeather | null;
}> {
  const highlight = await getMatchHighlight();
  if (!highlight?.matchId) {
    return { highlight: null, scorecard: null, liveFeed: null, weather: null };
  }

  if (highlight.matchId.startsWith("espn-")) {
    const [espn, weather] = await Promise.all([
      fetchEspnMatchCentre(highlight.matchId).catch(() => null),
      getHighlightWeather(highlight),
    ]);
    return {
      highlight,
      scorecard: espn?.scorecard ?? null,
      liveFeed: highlight.mode === "live" ? (espn?.liveFeed ?? null) : null,
      weather,
    };
  }

  const weather = await getHighlightWeather(highlight);

  if (!isCricApiConfigured() || highlight.matchId.startsWith("seed-")) {
    return { highlight, scorecard: null, liveFeed: null, weather };
  }

  try {
    const scorecard = await fetchScorecard(highlight.matchId);
    return { highlight, scorecard, liveFeed: null, weather };
  } catch {
    return { highlight, scorecard: null, liveFeed: null, weather };
  }
}
