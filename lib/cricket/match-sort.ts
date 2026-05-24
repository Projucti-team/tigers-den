import type { LiveMatchSummary } from "@/lib/cricket/types";

function matchStartTime(match: LiveMatchSummary): number {
  const iso = match.dateTimeGMT || match.date;
  if (!iso) return Number.POSITIVE_INFINITY;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
}

/** Chronological order (earliest first). Matches without a date go last. */
export function sortMatchesByDate(matches: LiveMatchSummary[]): LiveMatchSummary[] {
  return [...matches].sort((a, b) => matchStartTime(a) - matchStartTime(b));
}
