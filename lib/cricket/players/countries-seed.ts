export type CountrySeed = {
  slug: string;
  name: string;
  shortName?: string;
  espnTeamId?: number;
  iccTeamName?: string;
};

/** Nations we show squads/rankings for — extend as tours expand. */
export const COUNTRY_SEEDS: CountrySeed[] = [
  { slug: "bangladesh", name: "Bangladesh", shortName: "BAN", espnTeamId: 25, iccTeamName: "Bangladesh" },
  { slug: "australia", name: "Australia", shortName: "AUS", espnTeamId: 2, iccTeamName: "Australia" },
  { slug: "england", name: "England", shortName: "ENG", espnTeamId: 1, iccTeamName: "England" },
  { slug: "india", name: "India", shortName: "IND", espnTeamId: 6, iccTeamName: "India" },
  { slug: "pakistan", name: "Pakistan", shortName: "PAK", espnTeamId: 7, iccTeamName: "Pakistan" },
  { slug: "sri-lanka", name: "Sri Lanka", shortName: "SL", espnTeamId: 8, iccTeamName: "Sri Lanka" },
  { slug: "new-zealand", name: "New Zealand", shortName: "NZ", espnTeamId: 5, iccTeamName: "New Zealand" },
  { slug: "south-africa", name: "South Africa", shortName: "SA", espnTeamId: 3, iccTeamName: "South Africa" },
  { slug: "west-indies", name: "West Indies", shortName: "WI", espnTeamId: 4, iccTeamName: "West Indies" },
  { slug: "zimbabwe", name: "Zimbabwe", shortName: "ZIM", espnTeamId: 9, iccTeamName: "Zimbabwe" },
  { slug: "afghanistan", name: "Afghanistan", shortName: "AFG", espnTeamId: 40, iccTeamName: "Afghanistan" },
  { slug: "ireland", name: "Ireland", shortName: "IRE", espnTeamId: 29, iccTeamName: "Ireland" },
];

const ICC_NAME_TO_SLUG = new Map(
  COUNTRY_SEEDS.filter((c) => c.iccTeamName).map((c) => [c.iccTeamName!.toLowerCase(), c.slug]),
);

export function iccTeamNameToCountrySlug(teamName: string): string | null {
  return ICC_NAME_TO_SLUG.get(teamName.trim().toLowerCase()) ?? null;
}

export function espnTeamIdsFromSeeds(): number[] {
  return COUNTRY_SEEDS.map((c) => c.espnTeamId).filter((id): id is number => Number.isFinite(id));
}
