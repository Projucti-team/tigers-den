import type { LiveMatchSummary } from "@/lib/cricket/types";

/** First parseable start time on the match — CricAPI dateTimeGMT is often malformed. */
export function resolveMatchStartIso(match: LiveMatchSummary): string | undefined {
  for (const iso of [match.dateTimeGMT, match.date]) {
    if (!iso?.trim()) continue;
    const t = new Date(iso).getTime();
    if (!Number.isNaN(t)) return iso;
  }
  return undefined;
}

function matchStartTime(match: LiveMatchSummary): number {
  const iso = resolveMatchStartIso(match);
  if (!iso) return Number.POSITIVE_INFINITY;
  return new Date(iso).getTime();
}

/** Chronological order (earliest first). Matches without a date go last. */
export function sortMatchesByDate(matches: LiveMatchSummary[]): LiveMatchSummary[] {
  return [...matches].sort((a, b) => matchStartTime(a) - matchStartTime(b));
}
