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

/** Announced squads — ESPNcricinfo, Jun 2026 */
export const AUSTRALIA_BANGLADESH_2026_SQUADS: SeriesSquad[] = [
  {
    team: "Bangladesh — ODI squad",
    source:
      "https://www.espncricinfo.com/story/bangladesh-recall-mosaddek-after-four-years-for-odis-against-australia-1539528",
    players: [
      player("Mehidy Hasan Miraz (capt)", 350016),
      player("Soumya Sarkar", 330902),
      player("Saif Hassan", 1150523),
      player("Tanzid Hasan", 1113856),
      player("Najmul Hossain Shanto", 597805),
      player("Tawhid Hridoy", 1273808),
      player("Litton Das", 56029),
      player("Mosaddek Hossain", 330903),
      player("Nurul Hasan", 330756),
      player("Rishad Hossain", 1321710),
      player("Tanvir Islam", 1148234),
      player("Mustafizur Rahman", 530957),
      player("Taskin Ahmed", 599345),
      player("Shoriful Islam", 1279593),
      player("Nahid Rana", 1384319),
    ],
  },
  {
    team: "Australia — ODI squad",
    source:
      "https://www.espncricinfo.com/story/travis-head-out-of-bangladesh-tour-mitchell-marsh-to-miss-odis-todd-murphy-called-up-1539607",
    players: [
      player("Josh Inglis (capt)", 1142599),
      player("Xavier Bartlett", 1176483),
      player("Alex Carey", 502687),
      player("Cooper Connolly", 1283024),
      player("Ben Dwarshuis", 722302),
      player("Nathan Ellis", 785177),
      player("Cameron Green", 902965),
      player("Matthew Kuhnemann", 1021298),
      player("Marnus Labuschagne", 787987),
      player("Todd Murphy", 1181638),
      player("Oliver Peake", 1321695),
      player("Matthew Renshaw", 898873),
      player("Liam Scott", 1076376),
      player("Matt Short", 1170476),
      player("Adam Zampa", 475281),
    ],
  },
  {
    team: "Australia — T20I squad",
    source:
      "https://www.espncricinfo.com/story/travis-head-out-of-bangladesh-tour-mitchell-marsh-to-miss-odis-todd-murphy-called-up-1539607",
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

function squadKey(team: string): string {
  const n = team.toLowerCase();
  if (n.includes("bangladesh")) return "bangladesh";
  if (n.includes("australia") && n.includes("t20")) return "australia-t20";
  if (n.includes("australia")) return "australia-odi";
  return n;
}

export function mergeCuratedSquads(
  apiSquads: SeriesSquad[],
  curated: SeriesSquad[],
): SeriesSquad[] {
  if (!curated.length) return apiSquads;
  if (!apiSquads.length) return curated;

  const curatedKeys = new Set(curated.map((s) => squadKey(s.team)));
  const kept = apiSquads.filter((s) => !curatedKeys.has(squadKey(s.team)));
  return [...curated, ...kept];
}

/** Overlay curated squads and clean stale API warnings (used at read + sync time). */
export function applyCuratedTourSquads<T extends { tour: { name: string }; squads: SeriesSquad[]; warnings: string[] }>(
  detail: T,
): T {
  const curated = curatedSquadsForTour(detail.tour.name);
  const squads = mergeCuratedSquads(detail.squads, curated);

  const warnings = detail.warnings.filter(
    (w) =>
      !w.startsWith("Squads not published yet") &&
      !w.includes("Australia squads sourced from ESPNcricinfo"),
  );

  if (!squads.length) {
    warnings.push(
      "Squads not published yet for this series — check back closer to the first match.",
    );
  }

  return { ...detail, squads, warnings };
}
