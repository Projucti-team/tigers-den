import type { LiveMatchSummary } from "@/lib/cricket/types";

function matchFixtureMergeKey(match: LiveMatchSummary): string {
  const date = match.date ?? match.dateTimeGMT?.slice(0, 10) ?? "";
  const type = `${match.matchType ?? ""} ${match.name}`.toLowerCase();
  return `${date}|${type.replace(/\s+/g, "")}`;
}

function isPlaceholderStatus(status: string): boolean {
  return /match starts/i.test(status);
}

/**
 * Union both sources — CricAPI usually has the full future schedule first, ESPNcricinfo
 * usually has the most accurate/most current venue, time, and result data. Neither source
 * alone is trusted as "complete": every fixture from both lists is kept, with ESPN's data
 * overlaid on any fixture both sources agree on.
 */
export function mergeTourFixtures(
  espn: LiveMatchSummary[],
  cricapi: LiveMatchSummary[],
): LiveMatchSummary[] {
  if (!cricapi.length) return espn;
  if (!espn.length) return cricapi;

  const espnByKey = new Map<string, LiveMatchSummary>();
  for (const match of espn) {
    espnByKey.set(matchFixtureMergeKey(match), match);
  }

  const seen = new Set<string>();
  const merged: LiveMatchSummary[] = [];

  for (const cricapiMatch of cricapi) {
    const key = matchFixtureMergeKey(cricapiMatch);
    seen.add(key);
    const espnMatch = espnByKey.get(key);

    if (!espnMatch) {
      merged.push(cricapiMatch);
      continue;
    }

    const preferEspnStatus =
      !isPlaceholderStatus(espnMatch.status) &&
      (isPlaceholderStatus(cricapiMatch.status) || Boolean(espnMatch.score?.length));

    merged.push({
      ...cricapiMatch,
      status: preferEspnStatus ? espnMatch.status : cricapiMatch.status,
      score: espnMatch.score ?? cricapiMatch.score,
      isLive: espnMatch.isLive || cricapiMatch.isLive,
      venue: espnMatch.venue || cricapiMatch.venue,
      dateTimeGMT: espnMatch.dateTimeGMT || cricapiMatch.dateTimeGMT,
      id: espnMatch.id || cricapiMatch.id,
    });
  }

  // Fixtures ESPN has that CricAPI hasn't published yet (e.g. late schedule tweaks).
  for (const espnMatch of espn) {
    if (seen.has(matchFixtureMergeKey(espnMatch))) continue;
    merged.push(espnMatch);
  }

  return merged;
}
