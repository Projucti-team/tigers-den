import type { CricketFormat, Gender, RankedPlayer } from "@/lib/cricket/types";

export const BANGLADESH_NAMES = [
  "bangladesh",
  "ban",
  "bd",
  "bangladesh women",
  "ban women",
];

export const FORMATS: CricketFormat[] = ["test", "odi", "t20"];
export const GENDERS: Gender[] = ["men", "women"];

/** ICC does not publish women's Test rankings — ODI & T20I only */
export const FORMATS_BY_GENDER: Record<Gender, CricketFormat[]> = {
  men: ["test", "odi", "t20"],
  women: ["odi", "t20"],
};

export const CRICAPI_BASE = "https://api.cricapi.com/v1";

export const ICC_RANKINGS_BASE = "https://cricket-rankings-api.herokuapp.com/api/v1";

export const SPORTS_JUPITER_BASE = "https://cricket.sportsjupiter.com/v1";

export const CACHE_TTL_MS = 5 * 60 * 1000;

export function isBangladeshTeam(name: string): boolean {
  const n = name.toLowerCase();
  if (n.includes("bangladesh")) return true;
  if (/\bban\b/.test(n)) return true;
  if (/\bbd\b/.test(n)) return true;
  if (n.includes("bangladesh women") || n.includes("ban women")) return true;
  return false;
}

/** Best ICC-ranked player from Bangladesh in a discipline (lowest rank number). */
export function topBangladeshPlayer(players: RankedPlayer[]): RankedPlayer | null {
  const fromBd = players.filter((p) => isBangladeshTeam(p.team));
  if (!fromBd.length) return null;
  return fromBd.reduce((best, p) => (p.rank < best.rank ? p : best));
}

export function normalizeFormat(value: string): CricketFormat | null {
  const v = value.toLowerCase();
  if (v.includes("test")) return "test";
  if (v.includes("odi") || v.includes("one day")) return "odi";
  if (v.includes("t20") || v.includes("twenty")) return "t20";
  return null;
}
