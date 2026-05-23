import { FORMATS_BY_GENDER, topBangladeshPlayer } from "@/lib/cricket/constants";
import { enrichPlayerImage } from "@/lib/cricket/player-images";
import { getRankings } from "@/lib/cricket/services/rankings";
import { getWtcStandings, type WtcShowcase } from "@/lib/cricket/services/wtc";
import type {
  CricketFormat,
  FormatRankings,
  Gender,
  GenderRankings,
  RankedPlayer,
} from "@/lib/cricket/types";

export type FormatShowcase = {
  format: CricketFormat;
  label: string;
  bangladeshRank: number | null;
  bangladeshRating: number | null;
  topBatsman: RankedPlayer | null;
  topBowler: RankedPlayer | null;
  topAllRounder: RankedPlayer | null;
};

export type RankingsShowcase = {
  gender: Gender;
  formats: FormatShowcase[];
  warnings: string[];
};

const FORMAT_LABELS: Record<CricketFormat, string> = {
  test: "Test",
  odi: "ODI",
  t20: "T20I",
};

function resolveTopBangladesh(
  formatData: FormatRankings,
  discipline: "bat" | "bowl" | "allrounder",
): RankedPlayer | null {
  const stored =
    discipline === "bat"
      ? formatData.topBangladeshBatsman
      : discipline === "bowl"
        ? formatData.topBangladeshBowler
        : formatData.topBangladeshAllRounder;
  if (stored) return stored;
  const list =
    discipline === "bat"
      ? formatData.topBatsmen
      : discipline === "bowl"
        ? formatData.topBowlers
        : formatData.topAllRounders;
  return topBangladeshPlayer(list);
}

function hasRealPhoto(player: RankedPlayer | null): boolean {
  const url = player?.imageUrl ?? "";
  return Boolean(
    url &&
      !url.includes("ui-avatars.com") &&
      !url.includes("/icon512.") &&
      !url.includes("default-player-logo"),
  );
}

async function enrichFormatPlayers(formatData: FormatRankings) {
  const topBatsman = resolveTopBangladesh(formatData, "bat");
  const topBowler = resolveTopBangladesh(formatData, "bowl");
  const topAllRounder = resolveTopBangladesh(formatData, "allrounder");

  if (hasRealPhoto(topBatsman) && hasRealPhoto(topBowler) && hasRealPhoto(topAllRounder)) {
    return { topBatsman, topBowler, topAllRounder };
  }

  const [topBatsmanImg, topBowlerImg, topAllRounderImg] = await Promise.all([
    enrichPlayerImage(topBatsman),
    enrichPlayerImage(topBowler),
    enrichPlayerImage(topAllRounder),
  ]);
  return {
    topBatsman: topBatsmanImg,
    topBowler: topBowlerImg,
    topAllRounder: topAllRounderImg,
  };
}

async function buildShowcase(gender: Gender, data: GenderRankings): Promise<RankingsShowcase> {
  const formats: FormatShowcase[] = [];

  for (const format of FORMATS_BY_GENDER[gender]) {
    const bd = data.bangladesh[format];
    const players = await enrichFormatPlayers(data.players[format]);

    formats.push({
      format,
      label: FORMAT_LABELS[format],
      bangladeshRank: bd?.rank ?? null,
      bangladeshRating: bd?.rating ?? null,
      topBatsman: players.topBatsman,
      topBowler: players.topBowler,
      topAllRounder: players.topAllRounder,
    });
  }

  return { gender, formats, warnings: [] };
}

export type { WtcShowcase };

export async function getRankingsShowcase(): Promise<{
  men: RankingsShowcase;
  women: RankingsShowcase;
  wtc: WtcShowcase | null;
  warnings: string[];
}> {
  const [{ men, women, warnings: rankWarnings }, { wtc, warnings: wtcWarnings }] =
    await Promise.all([getRankings(), getWtcStandings()]);

  const [menShowcase, womenShowcase] = await Promise.all([
    buildShowcase("men", men),
    buildShowcase("women", women),
  ]);

  return {
    men: menShowcase,
    women: womenShowcase,
    wtc,
    warnings: [...rankWarnings, ...wtcWarnings],
  };
}
