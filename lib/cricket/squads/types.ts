export type SquadPlayer = {
  name: string;
  profileUrl?: string | null;
  imageUrl?: string | null;
};

export type SeriesSquad = {
  team: string;
  players: SquadPlayer[];
  source?: string;
};

export function cricinfoPlayerUrl(playerId: number, name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `https://www.espncricinfo.com/cricketers/${slug || "player"}-${playerId}`;
}

export function normalizeSquadPlayers(players: (string | SquadPlayer)[]): SquadPlayer[] {
  return players.map((p) => (typeof p === "string" ? { name: p } : p));
}

/** Nation before the em dash wins — "Australia — ODI squad (Bangladesh)" is Australia, not BD. */
export function squadPrimaryNation(team: string): string {
  const head = team.split(/\s*[—–-]\s*/)[0]?.toLowerCase().trim() ?? "";
  if (head.includes("bangladesh")) return "bangladesh";
  if (head.includes("australia")) return "australia";
  if (head.includes("england")) return "england";
  if (head.includes("india")) return "india";
  if (head.includes("pakistan")) return "pakistan";
  if (head.includes("sri lanka")) return "sri-lanka";
  if (head.includes("new zealand")) return "new-zealand";
  if (head.includes("south africa")) return "south-africa";
  if (head.includes("west indies")) return "west-indies";

  const n = team.toLowerCase();
  if (n.includes("bangladesh") && !n.includes("australia")) return "bangladesh";
  if (n.includes("australia")) return "australia";
  return head.replace(/\s+/g, "-") || "unknown";
}

function squadFormat(team: string): "t20" | "odi" {
  return /\bt20/i.test(team) ? "t20" : "odi";
}

export function squadKey(team: string): string {
  return `${squadPrimaryNation(team)}-${squadFormat(team)}`;
}

/** Prefer nation-matched, format-labelled ESPN story squads over generic core API lists. */
function squadQualityScore(squad: SeriesSquad, key: string): number {
  const [keyNation, keyFormat] = key.split("-");
  const nation = squadPrimaryNation(squad.team);
  const label = squad.team.toLowerCase();
  let score = squad.players.length;

  if (nation === keyNation) score += 100;
  if (keyFormat === "t20" && /\bt20/i.test(label)) score += 40;
  if (keyFormat === "odi" && /\bodi\b/i.test(label)) score += 40;
  if (squad.source?.includes("espncricinfo.com/story")) score += 25;
  if (/\s[—–-]\s/.test(squad.team)) score += 10;

  return score;
}

const SQUAD_NATION_ORDER = [
  "bangladesh",
  "australia",
  "england",
  "india",
  "pakistan",
  "sri-lanka",
  "new-zealand",
  "south-africa",
  "west-indies",
];

export function sortSquadsForDisplay(squads: SeriesSquad[]): SeriesSquad[] {
  return [...squads].sort((a, b) => {
    const nationA = squadPrimaryNation(a.team);
    const nationB = squadPrimaryNation(b.team);
    const orderA = SQUAD_NATION_ORDER.indexOf(nationA);
    const orderB = SQUAD_NATION_ORDER.indexOf(nationB);
    const rankA = orderA === -1 ? 99 : orderA;
    const rankB = orderB === -1 ? 99 : orderB;
    if (rankA !== rankB) return rankA - rankB;

    const fmtA = squadFormat(a.team);
    const fmtB = squadFormat(b.team);
    if (fmtA !== fmtB) return fmtA === "odi" ? -1 : 1;

    return a.team.localeCompare(b.team);
  });
}

export function mergeSquads(...lists: SeriesSquad[][]): SeriesSquad[] {
  const byKey = new Map<string, SeriesSquad>();

  for (const list of lists) {
    for (const squad of list) {
      const key = squadKey(squad.team);
      const existing = byKey.get(key);
      if (
        !existing ||
        squadQualityScore(squad, key) >= squadQualityScore(existing, key)
      ) {
        byKey.set(key, squad);
      }
    }
  }

  return sortSquadsForDisplay([...byKey.values()]);
}
