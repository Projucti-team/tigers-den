import type { LiveMatchSummary } from "@/lib/cricket/types";

export const BANGLADESH_TIMEZONE = "Asia/Dhaka";

export function formatBangladeshDate(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: BANGLADESH_TIMEZONE,
  }).format(d);
}

export function formatBangladeshTime(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const time = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: BANGLADESH_TIMEZONE,
  }).format(d);
  return `${time} BDT`;
}

export function formatBangladeshDateTime(iso?: string | null): string {
  const date = formatBangladeshDate(iso);
  const time = formatBangladeshTime(iso);
  if (!date && !time) return "";
  if (!time) return date;
  if (!date) return time;
  return `${date}, ${time}`;
}

/** Replace CricAPI "Match starts at … GMT" copy with Bangladesh time when possible. */
export function formatMatchStatus(match: LiveMatchSummary): string {
  const iso = match.dateTimeGMT || match.date;
  const status = match.status?.trim() ?? "";

  if (iso && /not started|upcoming|scheduled|fixture|match starts|toss/i.test(status)) {
    const date = formatBangladeshDate(iso);
    const time = formatBangladeshTime(iso);
    if (date && time) {
      return `Match starts ${date}, ${time}`;
    }
  }

  if (/GMT/i.test(status) && iso) {
    const converted = formatBangladeshDateTime(iso);
    if (converted) {
      return status.replace(/match starts at[^,]*,\s*[\d:]+\s*GMT/i, `Match starts ${converted}`);
    }
    return status.replace(/\sGMT\b/i, " BDT");
  }

  return status.replace(/\sGMT\b/i, " BDT");
}

export function formatMatchScheduleLine(match: LiveMatchSummary): string {
  const date = formatBangladeshDate(match.dateTimeGMT || match.date);
  const time = formatBangladeshTime(match.dateTimeGMT || match.date);
  return [date, time].filter(Boolean).join(" · ");
}
