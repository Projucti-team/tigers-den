export type SquadPlayer = {
  name: string;
  profileUrl?: string | null;
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

export function squadKey(team: string): string {
  const n = team.toLowerCase();
  if (n.includes("bangladesh") && n.includes("t20")) return "bangladesh-t20";
  if (n.includes("bangladesh")) return "bangladesh-odi";
  if (n.includes("australia") && n.includes("t20")) return "australia-t20";
  if (n.includes("australia")) return "australia-odi";
  return n.replace(/\s+/g, "-");
}

export function mergeSquads(...lists: SeriesSquad[][]): SeriesSquad[] {
  const byKey = new Map<string, SeriesSquad>();

  for (const list of lists) {
    for (const squad of list) {
      const key = squadKey(squad.team);
      const existing = byKey.get(key);
      if (!existing || squad.players.length > existing.players.length) {
        byKey.set(key, squad);
      }
    }
  }

  return [...byKey.values()];
}
