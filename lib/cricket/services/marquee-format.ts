import { isBangladeshTeam } from "@/lib/cricket/constants";
import { ordinalSuffix } from "@/lib/cricket/ordinal";
import { compactCricketScore } from "@/lib/cricket/score-format";
import { matchTime, type MatchHighlight } from "@/lib/cricket/services/match-highlight";
import type { LiveMatchSummary } from "@/lib/cricket/types";

export function teamShortCode(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("bangladesh") || n === "ban") return "Ban";
  if (n.includes("pakistan") || n === "pak") return "Pak";
  if (n.includes("australia") || n === "aus") return "Aus";
  if (n.includes("india") || n === "ind") return "Ind";
  if (n.includes("england") || n === "eng") return "Eng";
  if (n.includes("sri lanka") || n === "sl") return "SL";
  if (n.includes("new zealand") || n === "nz") return "NZ";
  if (n.includes("south africa") || n === "sa") return "SA";
  if (n.includes("west indies") || n === "wi") return "WI";
  if (n.includes("afghanistan") || n === "afg") return "Afg";
  if (n.includes("zimbabwe") || n === "zim") return "Zim";
  const word = name.trim().split(/\s+/)[0] || name;
  return word.length <= 4
    ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    : word.slice(0, 3).charAt(0).toUpperCase() + word.slice(1, 3).toLowerCase();
}

function teamFromInningsLabel(label: string): string {
  const cleaned = label.replace(/\s*\d+(?:st|nd|rd|th)\s*$/i, "").trim();
  return teamShortCode(cleaned);
}

/** Ban 284/8 vs Aus 91/3 (18) (Australia require another 194 runs…) */
export function formatLiveMarqueeLine(highlight: MatchHighlight): string {
  const ban = highlight.scores.find((s) => isBangladeshTeam(s.label));
  const opp = highlight.scores.find((s) => !isBangladeshTeam(s.label));

  if (ban && opp) {
    const banScore = compactCricketScore(ban.value, true);
    const oppScore = compactCricketScore(opp.value, false);
    const oppCode = teamShortCode(opp.label);
    const status = highlight.detailLine.replace(/Bangladesh/gi, "Ban");
    return `Ban ${banScore} vs ${oppCode} ${oppScore} (${status})`;
  }

  // One innings (or none) so far — still show the live status (toss, rain delay…).
  const scorePart = highlight.scoreLine.replace(/Bangladesh/gi, "Ban");
  const status = highlight.detailLine.replace(/Bangladesh/gi, "Ban");
  return status && !scorePart.includes(status) ? `${scorePart} (${status})` : scorePart;
}

/** Ban 278 & 390 vs Pak 232 & 358 (Ban won by 78 runs) */
export function formatLastMatchMarqueeLine(highlight: MatchHighlight): string {
  if (highlight.mode === "live") return formatLiveMarqueeLine(highlight);
  const byTeam = new Map<string, number[]>();

  for (const row of highlight.scores) {
    const runs = Number.parseInt(row.value, 10);
    if (Number.isNaN(runs)) continue;
    const code = teamFromInningsLabel(row.label);
    const list = byTeam.get(code) ?? [];
    list.push(runs);
    byTeam.set(code, list);
  }

  const banKey =
    [...byTeam.keys()].find((k) => k === "Ban") ?? [...byTeam.keys()][0];
  const oppKey = [...byTeam.keys()].find((k) => k !== banKey);

  if (banKey && oppKey && byTeam.get(banKey)?.length && byTeam.get(oppKey)?.length) {
    const banRuns = byTeam.get(banKey)!.join(" & ");
    const oppRuns = byTeam.get(oppKey)!.join(" & ");
    const result = highlight.detailLine
      .replace(/Bangladesh/gi, "Ban")
      .replace(/\bby\b/i, "by");
    return `Ban ${banRuns} vs ${oppKey} ${oppRuns} (${result})`;
  }

  const compact = highlight.scoreLine.replace(/\s*·\s*/g, " vs ");
  return `${compact} (${highlight.detailLine.replace(/Bangladesh/gi, "Ban")})`;
}

function formatOrdinalDay(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    timeZone: "Asia/Dhaka",
  }).formatToParts(d);
  const day = Number(parts.find((p) => p.type === "day")?.value ?? d.getDate());
  const month = parts.find((p) => p.type === "month")?.value ?? "";
  return `${day}${ordinalSuffix(day)} ${month}`;
}

import { formatBangladeshTime } from "@/lib/cricket/datetime-bd";

function venueCity(venue?: string): string {
  if (!venue) return "";
  return venue.split(",")[0]?.trim() ?? venue;
}

function opponentFromMatch(match: LiveMatchSummary): string {
  const teams = match.teams ?? match.teamInfo?.map((t) => t.name) ?? [];
  const opp = teams.find((t) => !isBangladeshTeam(t));
  if (opp) return teamShortCode(opp);

  const vs = match.name.match(/vs\.?\s+([^,]+)/i);
  if (vs?.[1] && !isBangladeshTeam(vs[1])) return teamShortCode(vs[1].trim());

  return "TBC";
}

function matchFormatLabel(match: LiveMatchSummary): string {
  const fromName = match.name.match(/(\d+)(?:st|nd|rd|th)\s+(odi|t20|test)/i);
  if (fromName) {
    const n = Number(fromName[1]);
    return `${n}${ordinalSuffix(n)} ${fromName[2].toUpperCase()}`;
  }

  const mt = (match.matchType || "").toLowerCase();
  if (mt === "odi") return "ODI";
  if (mt === "t20" || mt === "t20i") return "T20I";
  if (mt === "test") return "Test";
  return match.matchType?.toUpperCase() || "Match";
}

/** Ban vs Aus 1st ODI · 9th June · Dhaka · 14:00 */
export function formatUpcomingMatchMarqueeLine(match: LiveMatchSummary): string {
  const opp = opponentFromMatch(match);
  const format = matchFormatLabel(match);
  const when = matchTime(match);
  const datePart = when ? formatOrdinalDay(new Date(when)) : match.date ?? "";
  const city = venueCity(match.venue);
  const time = formatBangladeshTime(match.dateTimeGMT);

  return ["Ban vs", opp, format, datePart, city, time].filter(Boolean).join(" ");
}

function fixtureOrdinalLabel(text: string): string | null {
  return text.match(/\d+(?:st|nd|rd|th)\s+(?:odi|t20i?|test)/i)?.[0]?.toLowerCase() ?? null;
}

/** Hide a cached upcoming row when that fixture is already live. */
export function isUpcomingHiddenByLive(
  live: MatchHighlight,
  match: LiveMatchSummary,
): boolean {
  if (live.mode !== "live") return false;

  const kickoff = matchTime(match);
  if (kickoff > 0 && kickoff <= Date.now()) return true;

  const liveLabel = fixtureOrdinalLabel(`${live.title} ${live.scoreLine}`);
  const upcomingLabel = fixtureOrdinalLabel(match.name);
  if (liveLabel && upcomingLabel && liveLabel === upcomingLabel) return true;

  return false;
}

export function isUpcomingBangladeshMatch(match: LiveMatchSummary): boolean {
  const teams = match.teams ?? match.teamInfo?.map((t) => t.name) ?? [];
  const blob = `${match.name} ${teams.join(" ")}`.toLowerCase();
  const involvesBd =
    teams.some((t) => isBangladeshTeam(t)) ||
    blob.includes("bangladesh") ||
    blob.includes(" ban ");

  if (!involvesBd) return false;

  const status = match.status.toLowerCase();
  if (/not started|upcoming|scheduled|fixture|match starts|toss/i.test(status)) {
    return true;
  }

  const when = matchTime(match);
  if (when > Date.now() + 30 * 60 * 1000) {
    return !/won|lost|completed|finished|draw|abandon|no result/i.test(status);
  }

  return false;
}
