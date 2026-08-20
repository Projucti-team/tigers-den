import type { LiveMatchSummary } from "@/lib/cricket/types";

/**
 * Deliberately dependency-free (only types.ts, no imports from match-highlight.ts or
 * marquee-format.ts) so it's directly unit-testable — match-highlight.ts transitively pulls in
 * Payload's env loader via bangladesh-last-match.ts, which crashes when imported outside a
 * Next.js runtime, and marquee-format.ts imports matchTime from match-highlight.ts at its own
 * top level, so even an unrelated export from that file drags the same crash in. Small
 * duplication of matchTime()/date formatting here is the trade-off (see filter-published-tours.ts
 * and lib/analytics/ga-admin.ts for the same "duplicate a tiny pure helper for test isolation"
 * pattern already used elsewhere in this codebase).
 */
function matchTimeMs(match: LiveMatchSummary): number {
  const raw = match.dateTimeGMT || match.date;
  const t = raw ? new Date(raw).getTime() : 0;
  return Number.isNaN(t) ? 0 : t;
}

function ordinalSuffix(day: number): string {
  if (day >= 11 && day <= 13) return "th";
  switch (day % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
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

/**
 * Mustafizur Rahman — Kent vs Somerset · County Championship · 9th June
 *
 * For admin-tracked domestic fixtures (match.trackedPlayerName set) — deliberately not
 * formatUpcomingMatchMarqueeLine()'s "Ban vs X" shape, since neither side of a county match is
 * actually the Bangladesh team; leading with "Ban vs Kent" would wrongly imply Bangladesh
 * themselves are playing.
 */
export function formatUpcomingDomesticMarqueeLine(match: LiveMatchSummary): string {
  const teams = match.teams ?? match.teamInfo?.map((t) => t.name) ?? [];
  const matchup = teams.length >= 2 ? teams.join(" vs ") : match.name || "Match";
  const when = matchTimeMs(match);
  const datePart = when ? formatOrdinalDay(new Date(when)) : match.date ?? "";
  const player = match.trackedPlayerName ? `${match.trackedPlayerName} — ` : "";

  return [`${player}${matchup}`, match.leagueLabel, datePart].filter(Boolean).join(" · ");
}
