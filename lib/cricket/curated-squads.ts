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

function player(name: string, cricinfoId: number): SquadPlayer {
  return {
    name,
    profileUrl: cricinfoPlayerUrl(cricinfoId, name),
  };
}

/** Announced squads — ESPNcricinfo, May 2026 */
export const AUSTRALIA_BANGLADESH_2026_SQUADS: SeriesSquad[] = [
  {
    team: "Australia — ODI squad (Bangladesh)",
    source: "https://www.espncricinfo.com/story/ollie-peake-called-into-australia-s-odi-squad-big-three-absent-maxwell-left-out-of-t20s-1536219",
    players: [
      player("Mitchell Marsh (capt)", 272450),
      player("Xavier Bartlett", 1176483),
      player("Alex Carey", 502687),
      player("Cooper Connolly", 1283024),
      player("Ben Dwarshuis", 722302),
      player("Nathan Ellis", 785177),
      player("Cameron Green", 902965),
      player("Travis Head", 498028),
      player("Josh Inglis", 1142599),
      player("Matthew Kuhnemann", 1021298),
      player("Marnus Labuschagne", 787987),
      player("Matthew Renshaw", 898873),
      player("Tanveer Sangha", 1240422),
      player("Liam Scott", 1076376),
      player("Adam Zampa", 475281),
    ],
  },
  {
    team: "Australia — T20I squad (Bangladesh)",
    source: "https://www.espncricinfo.com/story/ollie-peake-called-into-australia-s-odi-squad-big-three-absent-maxwell-left-out-of-t20s-1536219",
    players: [
      player("Mitchell Marsh (capt)", 272450),
      player("Xavier Bartlett", 1176483),
      player("Cooper Connolly", 1283024),
      player("Tim David", 1150437),
      player("Joel Davies", 1295851),
      player("Nathan Ellis", 785177),
      player("Cameron Green", 902965),
      player("Aaron Hardie", 1187802),
      player("Travis Head", 498028),
      player("Josh Inglis", 1142599),
      player("Spencer Johnson", 1161381),
      player("Matthew Kuhnemann", 1021298),
      player("Riley Meredith", 774781),
      player("Josh Philippe", 630441),
      player("Matthew Renshaw", 898873),
      player("Adam Zampa", 475281),
    ],
  },
];

export function isAustraliaBangladeshSeries(tourName: string): boolean {
  const n = tourName.toLowerCase();
  return n.includes("australia") && n.includes("bangladesh");
}

export function curatedSquadsForTour(tourName: string): SeriesSquad[] {
  if (isAustraliaBangladeshSeries(tourName)) {
    return AUSTRALIA_BANGLADESH_2026_SQUADS;
  }
  return [];
}

export function normalizeSquadPlayers(players: (string | SquadPlayer)[]): SquadPlayer[] {
  return players.map((p) => (typeof p === "string" ? { name: p } : p));
}

export function mergeCuratedSquads(
  apiSquads: SeriesSquad[],
  curated: SeriesSquad[],
): SeriesSquad[] {
  if (!curated.length) return apiSquads;
  if (!apiSquads.length) return curated;

  const curatedTeams = new Set(curated.map((s) => s.team.toLowerCase()));
  const kept = apiSquads.filter((s) => !curatedTeams.has(s.team.toLowerCase()));
  return [...curated, ...kept];
}
