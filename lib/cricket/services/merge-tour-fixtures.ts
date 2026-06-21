import type { LiveMatchSummary } from "@/lib/cricket/types";

function matchFixtureMergeKey(match: LiveMatchSummary): string {
  const date = match.date ?? match.dateTimeGMT?.slice(0, 10) ?? "";
  const type = `${match.matchType ?? ""} ${match.name}`.toLowerCase();
  return `${date}|${type.replace(/\s+/g, "")}`;
}

function isPlaceholderStatus(status: string): boolean {
  return /match starts/i.test(status);
}

/** Prefer CricAPI's full list; overlay ESPN results, venues, and times where available. */
export function mergeTourFixtures(
  espn: LiveMatchSummary[],
  cricapi: LiveMatchSummary[],
): LiveMatchSummary[] {
  if (!cricapi.length || cricapi.length <= espn.length) return espn;
  if (!espn.length) return cricapi;

  const espnByKey = new Map<string, LiveMatchSummary>();
  for (const match of espn) {
    espnByKey.set(matchFixtureMergeKey(match), match);
  }

  return cricapi.map((cricapiMatch) => {
    const espnMatch = espnByKey.get(matchFixtureMergeKey(cricapiMatch));
    if (!espnMatch) return cricapiMatch;

    const preferEspnStatus =
      !isPlaceholderStatus(espnMatch.status) &&
      (isPlaceholderStatus(cricapiMatch.status) || Boolean(espnMatch.score?.length));

    return {
      ...cricapiMatch,
      status: preferEspnStatus ? espnMatch.status : cricapiMatch.status,
      score: espnMatch.score ?? cricapiMatch.score,
      isLive: espnMatch.isLive || cricapiMatch.isLive,
      venue: espnMatch.venue || cricapiMatch.venue,
      dateTimeGMT: espnMatch.dateTimeGMT || cricapiMatch.dateTimeGMT,
      id: espnMatch.id || cricapiMatch.id,
    };
  });
}
