import { isFutureSeries } from "@/lib/cricket/tour-dates";
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

function mergeTourStats(base: Tour, group: Tour[]): Tour {
  let test = 0;
  let odi = 0;
  let t20 = 0;
  let matches = 0;
  let startDate = base.startDate;
  let endDate = base.endDate;
  let teams = base.teams;

  for (const tour of group) {
    test += tour.test ?? 0;
    odi += tour.odi ?? 0;
    t20 += tour.t20 ?? 0;
    matches += tour.matches ?? 0;
    if (tour.startDate && (!startDate || tour.startDate < startDate)) startDate = tour.startDate;
    if (tour.endDate && (!endDate || tour.endDate > endDate)) endDate = tour.endDate;
    if (tour.teams?.length) teams = tour.teams;
  }

  return {
    ...base,
    startDate,
    endDate,
    test: test || base.test,
    odi: odi || base.odi,
    t20: t20 || base.t20,
    matches: matches || base.matches,
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

/** Collapse format-specific series into one umbrella tour per venue; dedupe ESPN + CricAPI doubles. */
export function deduplicateTours(tours: Tour[]): Tour[] {
  const byVenue = new Map<string, Tour[]>();

  for (const tour of tours) {
    const key = tourVenueKey(tour.name);
    const list = byVenue.get(key) ?? [];
    list.push(tour);
    byVenue.set(key, list);
  }

  const merged = [...byVenue.values()].map(collapseToUmbrellaTour);

  return merged
    .filter((t) => isFutureSeries(t.startDate, t.endDate))
    .sort((a, b) => {
      const da = a.startDate ? new Date(a.startDate).getTime() : 0;
      const db = b.startDate ? new Date(b.startDate).getTime() : 0;
      return da - db;
    });
}

export function matchBelongsToTour(match: LiveMatchSummary, tour: Tour): boolean {
  if (match.seriesId && tour.id && match.seriesId === tour.id) return true;

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
    if (seriesNorm === tourNorm) return true;
    if (tourVenueKey(match.seriesName) === tourVenueKey(tour.name)) {
      if (umbrella || !tourFormat || !matchFormatHint(match)) return true;
      return matchFormatHint(match) === tourFormat;
    }
  }

  if (umbrella && opponent && blob.includes(opponent)) return true;

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
