import { matchCategoryFromText } from "@/lib/cricket/match-category";
import type { BangladeshMatchStatus, BangladeshMatchUpsert } from "@/lib/cricket/services/bangladesh-matches-db";

/** The four real Bangladesh representative sides — never "domestic" (admin-tracked players). */
export type BangladeshTeamCategory = "men" | "women" | "u19" | "emerging";

export type RawCricApiMatch = {
  id: string;
  name: string;
  matchType?: string;
  status: string;
  date?: string;
  dateTimeGMT?: string;
  teams?: string[];
  score?: { r: number; w: number; o: number; inning?: string }[];
  isLive: boolean;
  seriesId?: string;
  seriesName?: string;
};

export type RawCricApiSeries = {
  id?: string;
  name?: string;
  startDate?: string;
  endDate?: string;
};

// Duplicated from match-highlight.ts's isActuallyLive/isCompletedMatch/matchTime rather than
// imported -- match-highlight.ts transitively pulls in Payload's env loader, which crashes under
// bare `node --test` outside a Next.js runtime (see marquee-priority.ts for the same pattern).
// Keeping the exact same regexes here so behavior stays identical; this is application logic
// duplicated once for test isolation, not a fork that's expected to drift.
function matchTimeMs(match: Pick<RawCricApiMatch, "date" | "dateTimeGMT">): number {
  const raw = match.dateTimeGMT || match.date;
  const t = raw ? new Date(raw).getTime() : 0;
  return Number.isNaN(t) ? 0 : t;
}

function isActuallyLive(match: Pick<RawCricApiMatch, "isLive" | "status">): boolean {
  if (!match.isLive) return false;
  const status = match.status.toLowerCase();
  if (/completed|finished|won|lost|draw|abandon|no result|stump day/i.test(status)) {
    return false;
  }
  return /live|in progress|innings|stumps|lunch|tea|drinks|rain delay|super over/i.test(status);
}

function isCompletedMatch(match: RawCricApiMatch): boolean {
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

  const playedAt = matchTimeMs(match);
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  if (playedAt > 0 && playedAt < oneHourAgo && (match.score?.length ?? 0) >= 1) {
    return true;
  }

  return false;
}

export function classifyMatchStatus(match: RawCricApiMatch): BangladeshMatchStatus {
  if (isActuallyLive(match)) return "live";
  if (isCompletedMatch(match)) return "completed";
  return "upcoming";
}

/**
 * A CricAPI series search under one category's search term (e.g. "bangladesh women") can still
 * return a match whose actual text clearly says something else (mixed tournaments, misfiled
 * series). Text classification wins when it detects something more specific than "men" -- but
 * matchCategoryFromText() defaults to "men" for anything it doesn't recognize, so when it lands
 * on "men" while we searched under a different category, trust the search context instead of
 * silently downgrading a women's/u19/emerging fixture to men's.
 */
export function resolveMatchCategory(
  searchCategory: BangladeshTeamCategory,
  match: Pick<RawCricApiMatch, "name" | "seriesName" | "teams">,
): BangladeshTeamCategory {
  const detected = matchCategoryFromText(match.name, match.seriesName, ...(match.teams ?? []));
  if (detected === "domestic") return searchCategory;
  if (detected === "men" && searchCategory !== "men") return searchCategory;
  return detected;
}

/**
 * CricAPI's series-search endpoint often returns dates with no year for near-term series --
 * confirmed live: "Bangladesh tour of Australia, 2026" (the actual current Test series) came back
 * as {"startDate":"Aug 06","endDate":"Aug 26"}, no year at all. Naively `new Date("Aug 26")`-ing
 * that mis-dates it (V8 defaults missing-year strings to 2001), which made isRelevantSeriesWindow
 * silently drop the series believing it was 25 years stale -- this is the same quirk
 * lib/cricket/tour-dates.ts's parseSeriesEndDate() already works around for the Tours page;
 * duplicated here (not imported) to keep this module dependency-free for tests.
 */
function parseCricApiDate(raw: string | undefined, yearHint: string | undefined): Date | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const d = new Date(trimmed);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const year =
    yearHint && /^\d{4}-\d{2}-\d{2}/.test(yearHint.trim())
      ? new Date(yearHint).getFullYear()
      : new Date().getFullYear();
  const d = new Date(`${trimmed} ${year}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Only keep series recently finished, currently on, or announced for the reasonably near future. */
export function isRelevantSeriesWindow(
  series: Pick<RawCricApiSeries, "startDate" | "endDate">,
  now = Date.now(),
): boolean {
  const start = parseCricApiDate(series.startDate, series.endDate);
  const end = parseCricApiDate(series.endDate, series.startDate);
  const reference = end ?? start;
  if (!reference) return false;

  const minAgeMs = now - 120 * 24 * 60 * 60 * 1000; // 120 days in the past
  const maxAheadMs = now + 365 * 24 * 60 * 60 * 1000; // 1 year out
  return reference.getTime() >= minAgeMs && reference.getTime() <= maxAheadMs;
}

function opponentFromTeams(
  teams: string[] | undefined,
  isBangladeshTeamFn: (name: string) => boolean,
): string | undefined {
  return teams?.find((t) => !isBangladeshTeamFn(t));
}

function formatScoreSummary(match: RawCricApiMatch): string | undefined {
  if (!match.score?.length) return undefined;
  return match.score
    .map((inn) => `${inn.inning ? `${inn.inning}: ` : ""}${inn.r}/${inn.w} (${inn.o})`)
    .join(" · ");
}

export function mapCricApiMatchToUpsertRow(
  match: RawCricApiMatch,
  category: BangladeshTeamCategory,
  series: RawCricApiSeries,
  isBangladeshTeamFn: (name: string) => boolean,
): BangladeshMatchUpsert {
  const status = classifyMatchStatus(match);
  const resolvedCategory = resolveMatchCategory(category, match);

  return {
    match_id: `cricapi-${match.id}`,
    team_category: resolvedCategory,
    match_type: match.matchType ?? null,
    status,
    status_text: match.status || null,
    teams: match.teams ?? null,
    opponent: opponentFromTeams(match.teams, isBangladeshTeamFn) ?? null,
    score_summary: formatScoreSummary(match) ?? null,
    venue: null,
    match_date: match.dateTimeGMT ?? match.date ?? null,
    series_id: match.seriesId ?? series.id ?? null,
    series_name: match.seriesName ?? series.name ?? null,
    espn_league_id: null,
    espn_event_id: null,
    source: "cricapi",
  };
}
