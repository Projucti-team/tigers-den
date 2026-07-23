import { isFutureSeries } from "@/lib/cricket/tour-dates";
import { resolveMatchStartIso } from "@/lib/cricket/match-sort";
import { squadPrimaryNation } from "@/lib/cricket/squads/types";
import type { LiveMatchSummary, Tour } from "@/lib/cricket/types";

export type TourGender = "men" | "women";

export function normalizeTourName(name: string): string {
  return name
    .toLowerCase()
    .replace(/,?\s*\d{4}(-\d{2})?$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function tourGender(name: string): TourGender {
  return /women/i.test(name) ? "women" : "men";
}

export function isWomenMatch(match: LiveMatchSummary): boolean {
  const blob = `${match.name} ${match.teams?.join(" ") ?? ""} ${match.seriesName ?? ""}`;
  return /women/i.test(blob);
}

/** Umbrella title without format — e.g. "Bangladesh Tour of Australia". */
export function isUmbrellaTourName(name: string): boolean {
  if (/\b(test series|odi series|t20i series|t20 series|test match)\b/i.test(name)) {
    return false;
  }
  if (/\bworld cup\b|\bchampions trophy\b|\basia cup\b/i.test(name)) {
    return false;
  }
  return /\btour of\b/i.test(name);
}

function slugifyNation(fragment: string): string {
  return fragment
    .toLowerCase()
    .replace(/\s+women$/i, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

/**
 * Groups bilateral tours so "Bangladesh Tour of Australia" and
 * "Bangladesh in Australia T20I Series" collapse together.
 */
export function tourVenueKey(name: string): string {
  const gender = tourGender(name);
  const n = name.toLowerCase();

  let m = n.match(/bangladesh(?:\s+women)?\s+tour of\s+([^,]+)/);
  if (m) return `${gender}:bd-at:${slugifyNation(m[1])}`;

  m = n.match(/bangladesh(?:\s+women)?\s+in\s+([^,]+?)(?:\s+(?:test|odi|t20)|,|$)/);
  if (m) return `${gender}:bd-at:${slugifyNation(m[1])}`;

  m = n.match(/(.+?)\s+tour of\s+bangladesh(?:\s+women)?/);
  if (m) return `${gender}:${slugifyNation(m[1])}-at:bd`;

  m = n.match(/(.+?)\s+in\s+bangladesh(?:\s+women)?(?:\s+(?:test|odi|t20)|,|$)/);
  if (m) return `${gender}:${slugifyNation(m[1])}-at:bd`;

  if (/\bworld cup\b|\bchampions trophy\b|\basia cup\b/i.test(name)) {
    return `${gender}:event:${normalizeTourName(name)}`;
  }

  return `${gender}:other:${normalizeTourName(name)}`;
}

/** Same bilateral tour direction (e.g. BD in Australia ≠ Australia in BD). */
export function tourNamesShareVenue(a: string, b: string): boolean {
  if (tourGender(a) !== tourGender(b)) return false;
  return tourVenueKey(a) === tourVenueKey(b);
}

/** Host nation slug from tour title — `bangladesh`, `australia`, etc. */
export function tourHostNationSlug(name: string): string | null {
  const key = tourVenueKey(name);
  let m = key.match(/^(?:men|women):bd-at:([^:]+)$/);
  if (m) return m[1];
  m = key.match(/^(?:men|women):([^:]+)-at:bd$/);
  if (m) return "bangladesh";
  return null;
}

/**
 * Best-effort city hints for the looser (non-seriesId-linked) matching paths below --
 * necessarily incomplete since international cricket is played at dozens of smaller/regional
 * venues per country (e.g. Darwin, Mackay for Australia; Bloemfontein, Paarl for South Africa).
 * Never gate the *trusted* match.seriesId === tour.id path on this list (see
 * matchBelongsToTour) -- a resolved series/league link is already authoritative and doesn't
 * need venue-name corroboration, which silently drops genuine fixtures at venues we forgot
 * to list here.
 */
// City names only -- deliberately no bare country-name fallback (e.g. "|australia"). This
// list is used to detect a CONTRADICTION (a venue clearly in a different country than
// expected), and match.name / venueBlob almost always contains both teams' country names
// (e.g. "Bangladesh vs Australia") regardless of where the match is actually played, on a
// site that only tracks Bangladesh's matches. A bare country-name signal would misfire on
// every single away tour, since "Bangladesh" is unavoidably present as the touring team.
const HOST_VENUE_HINTS: Record<string, RegExp> = {
  bangladesh:
    /dhaka|chattogram|chittagong|sylhet|mirpur|bogura|bogra|fatullah|khulna|rajshahi|cox'?s bazar/i,
  australia:
    /melbourne|sydney|brisbane|adelaide|perth|hobart|canberra|darwin|mackay|cairns|townsville|geelong|launceston|alice springs/i,
  zimbabwe: /harare|bulawayo|kwekwe|mutare|victoria falls/i,
  "newzealand":
    /auckland|wellington|christchurch|dunedin|hamilton|napier|mount maunganui|tauranga|nelson|queenstown/i,
  "southafrica":
    /johannesburg|centurion|cape town|durban|bloemfontein|gqeberha|port elizabeth|east london|paarl|potchefstroom|benoni|kimberley|pietermaritzburg/i,
  india:
    /mumbai|delhi|bangalore|bengaluru|chennai|kolkata|hyderabad|ahmedabad|pune|indore|rajkot|guwahati|ranchi|cuttack|nagpur|lucknow|dharamsala|dharamshala|thiruvananthapuram|mohali|visakhapatnam/i,
  pakistan: /karachi|lahore|islamabad|rawalpindi|multan|faisalabad|sialkot|gujranwala|peshawar/i,
  england:
    /london|manchester|birmingham|leeds|cardiff|southampton|nottingham|durham|chester-le-street|bristol|taunton/i,
  "srilanka": /colombo|kandy|galle|pallekele|hambantota|dambulla/i,
  "westindies":
    /barbados|bridgetown|jamaica|kingston|antigua|guyana|georgetown|trinidad|port of spain|st lucia|grenada|st kitts|dominica/i,
};

/**
 * True unless the venue text clearly names a DIFFERENT host nation than the tour's --
 * a genuine contradiction (e.g. a "Bangladesh Tour of Australia" match actually played in
 * Dhaka, a sign the match was mistagged with the wrong series id). Deliberately not an
 * allow-list requiring the venue to appear in the tour's own HOST_VENUE_HINTS: that list can
 * never enumerate every regional ground a country hosts (Darwin, Mackay, Bloemfontein, ...),
 * and rejecting on "not in my list" silently drops genuine fixtures at venues we forgot to
 * add. Only reject on positive evidence of a different country.
 */
export function matchVenueMatchesTourHost(match: LiveMatchSummary, tourName: string): boolean {
  const host = tourHostNationSlug(tourName);
  if (!host) return true;

  const venueBlob = `${match.venue ?? ""} ${match.name}`.trim();
  if (!venueBlob) return true;

  for (const [nation, pattern] of Object.entries(HOST_VENUE_HINTS)) {
    if (nation === host) continue;
    if (pattern.test(venueBlob)) return false;
  }

  return true;
}

export function extractOpponentNation(name: string): string | null {
  let m = name.match(/bangladesh(?:\s+women)?\s+tour of\s+([^,]+)/i);
  if (m) return slugifyNation(m[1]);

  m = name.match(/bangladesh(?:\s+women)?\s+in\s+([^,]+?)(?:\s+(?:Test|ODI|T20)|,|$)/i);
  if (m) return slugifyNation(m[1]);

  m = name.match(/(.+?)\s+tour of\s+bangladesh(?:\s+women)?/i);
  if (m) return slugifyNation(m[1]);

  m = name.match(/(.+?)\s+in\s+bangladesh(?:\s+women)?/i);
  if (m) return slugifyNation(m[1]);

  return null;
}

/** Home/away tour team order for fixture labels — Bangladesh first on home tours. */
export function parseTourTeamsFromName(name: string): string[] | undefined {
  const away = name.match(/bangladesh tour of ([^,]+)/i);
  if (away) return ["Bangladesh", away[1].trim()];
  const home = name.match(/([^,]+) tour of bangladesh/i);
  if (home) return ["Bangladesh", home[1].trim()];
  return undefined;
}

export function extractFormatHint(name: string): "test" | "odi" | "t20" | null {
  const n = name.toLowerCase();
  if (/\btest\b/.test(n)) return "test";
  if (/\bodi|one.?day\b/.test(n)) return "odi";
  if (/\bt20/.test(n)) return "t20";
  return null;
}

function matchFormatHint(match: LiveMatchSummary): "test" | "odi" | "t20" | null {
  const blob = `${match.matchType ?? ""} ${match.name}`.toLowerCase();
  if (/\btest\b/.test(blob)) return "test";
  if (/\bodi|one.?day\b/.test(blob)) return "odi";
  if (/\bt20/.test(blob)) return "t20";
  return null;
}

function parseTourEndTime(endDate: string | undefined, startDate?: string): number | null {
  if (!endDate) return null;
  const trimmed = endDate.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const end = new Date(trimmed).getTime();
    return Number.isNaN(end) ? null : end;
  }
  const year = startDate ? new Date(startDate).getFullYear() : new Date().getFullYear();
  const end = new Date(`${trimmed} ${year}`).getTime();
  return Number.isNaN(end) ? null : end;
}

/** Keep fixtures inside the tour window — blocks historical matches from loose name matching. */
export function matchWithinTourWindow(match: LiveMatchSummary, tour: Tour): boolean {
  if (!tour.startDate) return true;

  const matchIso = resolveMatchStartIso(match);
  if (!matchIso) return true;

  const matchTime = new Date(matchIso).getTime();
  const startTime = new Date(tour.startDate).getTime() - 14 * 86_400_000;
  const parsedEnd = parseTourEndTime(tour.endDate, tour.startDate);
  const endTime =
    parsedEnd !== null ? parsedEnd + 14 * 86_400_000 : startTime + 150 * 86_400_000;

  return matchTime >= startTime && matchTime <= endTime;
}

export function countTourFormatsFromMatches(
  matches: LiveMatchSummary[],
): { test: number; odi: number; t20: number } {
  let test = 0;
  let odi = 0;
  let t20 = 0;

  for (const match of matches) {
    const format = matchFormatHint(match);
    if (format === "test") test += 1;
    else if (format === "odi") odi += 1;
    else if (format === "t20") t20 += 1;
  }

  return { test, odi, t20 };
}

export function applyFormatCountsFromMatches(tour: Tour, matches: LiveMatchSummary[]): Tour {
  const { test, odi, t20 } = countTourFormatsFromMatches(matches);
  const total = test + odi + t20;
  if (total === 0) return tour;

  return {
    ...tour,
    test: test || undefined,
    odi: odi || undefined,
    t20: t20 || undefined,
    matches: total,
  };
}

function mergeTourStats(base: Tour, group: Tour[]): Tour {
  let test = base.test ?? 0;
  let odi = base.odi ?? 0;
  let t20 = base.t20 ?? 0;
  let matches = base.matches ?? 0;
  let startDate = base.startDate;
  let endDate = base.endDate;
  let teams = base.teams;

  for (const tour of group) {
    test = Math.max(test, tour.test ?? 0);
    odi = Math.max(odi, tour.odi ?? 0);
    t20 = Math.max(t20, tour.t20 ?? 0);
    matches = Math.max(matches, tour.matches ?? 0);
    if (tour.startDate && (!startDate || tour.startDate < startDate)) startDate = tour.startDate;
    if (tour.endDate && (!endDate || tour.endDate > endDate)) endDate = tour.endDate;
    if (tour.teams?.length) teams = tour.teams;
  }

  return {
    ...base,
    startDate,
    endDate,
    test: test || undefined,
    odi: odi || undefined,
    t20: t20 || undefined,
    matches: matches || undefined,
    teams,
  };
}

function pickTourId(group: Tour[]): string {
  const umbrella = group.find((t) => isUmbrellaTourName(t.name));
  if (umbrella?.id) return umbrella.id;
  const numeric = group.find((t) => /^\d+$/.test(t.id));
  return numeric?.id ?? group[0].id;
}

/** One nav row per bilateral tour — e.g. "Bangladesh Tour of Australia", not per format. */
function inferUmbrellaNameFromGroup(group: Tour[]): string {
  const existing = group.find((t) => isUmbrellaTourName(t.name));
  if (existing) {
    return existing.name.replace(/,?\s*\d{4}(-\d{2})?$/i, "").trim();
  }

  for (const tour of group) {
    const stripped = tour.name.replace(/,?\s*\d{4}(-\d{2})?$/i, "").trim();

    let m = stripped.match(/bangladesh(?:\s+women)?\s+tour of\s+(.+)$/i);
    if (m) return stripped;

    m = stripped.match(/bangladesh(?:\s+women)?\s+in\s+([^,]+?)(?:\s+(?:Test|ODI|T20)|,|$)/i);
    if (m) {
      const women = /women/i.test(stripped) ? " Women" : "";
      return `Bangladesh${women} Tour of ${m[1].trim()}`;
    }

    m = stripped.match(/(.+?)\s+tour of\s+bangladesh(?:\s+women)?$/i);
    if (m) return stripped;

    m = stripped.match(/(.+?)\s+in\s+bangladesh(?:\s+women)?(?:\s+(?:Test|ODI|T20)|,|$)/i);
    if (m) {
      const women = /women/i.test(stripped) ? " Women" : "";
      return `${m[1].trim()}${women} Tour of Bangladesh`;
    }
  }

  return group[0].name.replace(/,?\s*\d{4}(-\d{2})?$/i, "").trim();
}

function collapseToUmbrellaTour(group: Tour[]): Tour {
  const name = inferUmbrellaNameFromGroup(group);
  const id = pickTourId(group);
  const seed =
    group.find((t) => normalizeTourName(t.name) === normalizeTourName(name)) ??
    group.find((t) => isUmbrellaTourName(t.name)) ??
    group[0];

  return mergeTourStats({ ...seed, id, name }, group);
}

/** Same bilateral tour in the same season — avoids merging 2024 and 2026 rows. */
export function tourSeasonKey(tour: Pick<Tour, "name" | "startDate">): string {
  const base = tourVenueKey(tour.name);
  const year = tour.startDate ? new Date(tour.startDate).getFullYear() : 0;
  return year > 0 ? `${base}:${year}` : base;
}

/** Collapse format-specific series into one umbrella tour per venue; dedupe ESPN + CricAPI doubles. */
export function deduplicateTours(tours: Tour[]): Tour[] {
  const bySeason = new Map<string, Tour[]>();

  for (const tour of tours) {
    const key = tourSeasonKey(tour);
    const list = bySeason.get(key) ?? [];
    list.push(tour);
    bySeason.set(key, list);
  }

  const merged = [...bySeason.values()].map(collapseToUmbrellaTour);

  return merged
    .filter((t) => isFutureSeries(t.startDate, t.endDate))
    .sort((a, b) => {
      const da = a.startDate ? new Date(a.startDate).getTime() : 0;
      const db = b.startDate ? new Date(b.startDate).getTime() : 0;
      return da - db;
    });
}

export function matchBelongsToTour(match: LiveMatchSummary, tour: Tour): boolean {
  if (match.seriesId && tour.id && match.seriesId === tour.id) {
    return matchVenueMatchesTourHost(match, tour.name) && matchWithinTourWindow(match, tour);
  }

  const matchWomen = isWomenMatch(match);
  const tourWomen = tourGender(tour.name) === "women";
  if (matchWomen !== tourWomen) return false;

  const blob = `${match.name} ${match.teams?.join(" ") ?? ""} ${match.seriesName ?? ""}`.toLowerCase();

  if (/\bworld cup\b/i.test(tour.name)) {
    if (!/\bworld cup\b/i.test(blob)) return false;
    return tourWomen ? /women/i.test(blob) : !/women/i.test(blob);
  }

  const opponent = extractOpponentNation(tour.name);
  if (opponent && !blob.includes(opponent)) return false;

  const umbrella = isUmbrellaTourName(tour.name);
  const tourFormat = extractFormatHint(tour.name);

  if (!umbrella && tourFormat) {
    const matchFormat = matchFormatHint(match);
    if (matchFormat && matchFormat !== tourFormat) return false;
  }

  if (match.seriesName) {
    const seriesNorm = normalizeTourName(match.seriesName);
    const tourNorm = normalizeTourName(tour.name);
    if (seriesNorm === tourNorm) {
      return matchVenueMatchesTourHost(match, tour.name) && matchWithinTourWindow(match, tour);
    }
    if (tourVenueKey(match.seriesName) === tourVenueKey(tour.name)) {
      if (tourSeasonKey({ name: tour.name, startDate: tour.startDate }) !== tourSeasonKey({ name: match.seriesName, startDate: match.date ?? match.dateTimeGMT })) {
        return false;
      }
      if (umbrella || !tourFormat || !matchFormatHint(match)) {
        return matchVenueMatchesTourHost(match, tour.name) && matchWithinTourWindow(match, tour);
      }
      return (
        matchFormatHint(match) === tourFormat &&
        matchVenueMatchesTourHost(match, tour.name) &&
        matchWithinTourWindow(match, tour)
      );
    }
  }

  if (umbrella && opponent && blob.includes(opponent)) {
    return matchVenueMatchesTourHost(match, tour.name) && matchWithinTourWindow(match, tour);
  }

  return false;
}

/** Expected fixtures from tour metadata (format counts or total matches). */
export function expectedTourFixtureCount(tour: Tour): number {
  const fromFormats = (tour.test ?? 0) + (tour.odi ?? 0) + (tour.t20 ?? 0);
  if (fromFormats > 0) return fromFormats;
  return tour.matches ?? 0;
}

export function fixturesCoverTourFormats(tour: Tour, matches: LiveMatchSummary[]): boolean {
  const counts = countTourFormatsFromMatches(matches);
  if ((tour.test ?? 0) > 0 && counts.test < (tour.test ?? 0)) return false;
  if ((tour.odi ?? 0) > 0 && counts.odi < (tour.odi ?? 0)) return false;
  if ((tour.t20 ?? 0) > 0 && counts.t20 < (tour.t20 ?? 0)) return false;
  return true;
}

/** True when ESPN returned enough fixtures for the tour's published match count. */
export function espnFixturesLookComplete(tour: Tour, matches: LiveMatchSummary[]): boolean {
  if (!matches.length) return false;

  const { test, odi, t20 } = countTourFormatsFromMatches(matches);
  const labelledFixtures = test + odi + t20;
  const metaExpected = expectedTourFixtureCount(tour);
  const metadataInflated =
    metaExpected > 0 && labelledFixtures >= 3 && metaExpected > labelledFixtures * 2;

  if (metaExpected > 0 && !metadataInflated && !fixturesCoverTourFormats(tour, matches)) {
    return false;
  }

  if (labelledFixtures > 0 && labelledFixtures === matches.length) {
    if (labelledFixtures >= metaExpected) return true;
    if (metadataInflated) return true;
  }

  return matches.length >= metaExpected;
}

/** Drop fixtures copied from the wrong bilateral tour or host country. */
export function filterMatchesForTour(tour: Tour, matches: LiveMatchSummary[]): LiveMatchSummary[] {
  return matches.filter(
    (match) => matchBelongsToTour(match, tour) && matchVenueMatchesTourHost(match, tour.name),
  );
}

const OPPONENT_NATIONS = [
  "australia",
  "bangladesh",
  "england",
  "india",
  "pakistan",
  "sri lanka",
  "new zealand",
  "south africa",
  "west indies",
  "zimbabwe",
];

function normalizeNationSlug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/** Both teams in a bilateral tour — used to route ESPN squad blocks. */
export function tourParticipantSlugs(tourName: string): Set<string> {
  const participants = new Set<string>();
  for (const value of [extractOpponentNation(tourName), tourHostNationSlug(tourName), "bangladesh"]) {
    if (value) participants.add(normalizeNationSlug(value));
  }
  return participants;
}

/** Route squad announcement blocks to the correct bilateral tour. */
export function squadBelongsToTour(
  squad: { team: string; source?: string },
  tour: Tour,
): boolean {
  if (tourNamesShareVenue(tour.name, squad.team)) return true;

  const blob = `${squad.team} ${squad.source ?? ""}`.toLowerCase();
  const tourWomen = tourGender(tour.name) === "women";
  if (/women/i.test(blob) !== tourWomen) return false;

  const participants = tourParticipantSlugs(tour.name);
  const squadNation = normalizeNationSlug(squadPrimaryNation(squad.team));
  if (!participants.has(squadNation)) return false;

  const teamBlob = squad.team.toLowerCase();
  for (const nation of OPPONENT_NATIONS) {
    const slug = normalizeNationSlug(nation);
    if (participants.has(slug)) continue;
    if (teamBlob.includes(nation)) return false;
  }

  if (!isUmbrellaTourName(tour.name)) return false;

  const squadFormat = extractFormatHint(squad.team);
  if (!squadFormat) return true;

  const hasFormatCounts = (tour.test ?? 0) + (tour.odi ?? 0) + (tour.t20 ?? 0) > 0;
  if (!hasFormatCounts) return true;

  if (squadFormat === "test") return (tour.test ?? 0) > 0;
  if (squadFormat === "odi") return (tour.odi ?? 0) > 0;
  if (squadFormat === "t20") return (tour.t20 ?? 0) > 0;

  return false;
}

export function tourMatchesCuratedSeries(
  tour: Tour,
  curatedName: string,
  seriesId: string,
  cricinfoSeriesId?: number,
): boolean {
  const tourId = String(tour.id);
  if (tourId === seriesId || tourId === String(cricinfoSeriesId ?? "")) return true;

  if (tourGender(tour.name) !== tourGender(curatedName)) return false;

  if (tourVenueKey(tour.name) !== tourVenueKey(curatedName)) return false;

  const tourFormat = extractFormatHint(tour.name);
  const curatedFormat = extractFormatHint(curatedName);
  if (tourFormat && curatedFormat && tourFormat !== curatedFormat) return false;

  const tourNorm = normalizeTourName(tour.name);
  const curatedNorm = normalizeTourName(curatedName);
  if (tourNorm === curatedNorm) return true;

  if (isUmbrellaTourName(tour.name) && !isUmbrellaTourName(curatedName)) return true;

  return false;
}
