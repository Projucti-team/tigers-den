import {
  FORMATS_BY_GENDER,
  RANKINGS_TEAM_TOP,
  bangladeshPlayersInTopRank,
  topBangladeshPlayer,
} from "@/lib/cricket/constants";
import { enrichPlayerImage } from "@/lib/cricket/player-images";
import type { IccRankingsSnapshot } from "@/lib/cricket/providers/icc-sportz";
import { getRankings, rankingsFromIccSnapshot } from "@/lib/cricket/services/rankings";
import { getWtcStandings, wtcShowcaseFromSnapshot, type WtcShowcase } from "@/lib/cricket/services/wtc";
import type { WtcStandingsSnapshot } from "@/lib/cricket/types";
import {
  RANKINGS_SHOWCASE_VERSION,
  type RankingsShowcaseSnapshot,
} from "@/lib/cricket/snapshot-types";
import type {
  CricketFormat,
  FormatRankings,
  Gender,
  GenderRankings,
  RankedPlayer,
  RankedTeam,
} from "@/lib/cricket/types";

export type FormatShowcase = {
  format: CricketFormat;
  label: string;
  bangladeshRank: number | null;
  bangladeshRating: number | null;
  topBatsman: RankedPlayer | null;
  topBowler: RankedPlayer | null;
  topAllRounder: RankedPlayer | null;
  topTeams: RankedTeam[];
  bangladeshBatters: RankedPlayer[];
  bangladeshBowlers: RankedPlayer[];
  bangladeshAllRounders: RankedPlayer[];
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

export function emptyFormatShowcase(format: CricketFormat): FormatShowcase {
  return {
    format,
    label: FORMAT_LABELS[format],
    bangladeshRank: null,
    bangladeshRating: null,
    topBatsman: null,
    topBowler: null,
    topAllRounder: null,
    topTeams: [],
    bangladeshBatters: [],
    bangladeshBowlers: [],
    bangladeshAllRounders: [],
  };
}

export function emptyRankingsShowcase(gender: Gender): RankingsShowcase {
  return {
    gender,
    formats: FORMATS_BY_GENDER[gender].map((format) => emptyFormatShowcase(format)),
    warnings: [],
  };
}

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
  if (!url || url.includes("ui-avatars.com")) return false;
  if (url.includes("/icon512.") || url.includes("default-player-logo")) return false;
  if (player?.iccPlayerId && url.includes("a.espncdn.com")) return false;
  return true;
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
    const formatPlayers = data.players[format];
    const players = await enrichFormatPlayers(formatPlayers);

    formats.push({
      format,
      label: FORMAT_LABELS[format],
      bangladeshRank: bd?.rank ?? null,
      bangladeshRating: bd?.rating ?? null,
      topBatsman: players.topBatsman,
      topBowler: players.topBowler,
      topAllRounder: players.topAllRounder,
      topTeams: data.teams[format].slice(0, RANKINGS_TEAM_TOP),
      bangladeshBatters: bangladeshPlayersInTopRank(formatPlayers.topBatsmen),
      bangladeshBowlers: bangladeshPlayersInTopRank(formatPlayers.topBowlers),
      bangladeshAllRounders: bangladeshPlayersInTopRank(formatPlayers.topAllRounders),
    });
  }

  return { gender, formats, warnings: [] };
}

type RankingsSourceSnapshots = {
  icc?: IccRankingsSnapshot | null;
  wtc?: WtcStandingsSnapshot | null;
};

/** Live build — only used by the nightly sync job. */
export async function buildRankingsShowcaseLive(
  sources?: RankingsSourceSnapshots,
): Promise<RankingsShowcaseSnapshot> {
  const [{ men, women, warnings: rankWarnings }, { wtc, warnings: wtcWarnings }] =
    await Promise.all([
      sources?.icc
        ? Promise.resolve({ ...rankingsFromIccSnapshot(sources.icc), warnings: [] as string[] })
        : getRankings(),
      sources?.wtc
        ? Promise.resolve({
            wtc: wtcShowcaseFromSnapshot(sources.wtc),
            warnings: [] as string[],
          })
        : getWtcStandings(),
    ]);

  const [menShowcase, womenShowcase] = await Promise.all([
    buildShowcase("men", men),
    buildShowcase("women", women),
  ]);

  return {
    version: RANKINGS_SHOWCASE_VERSION,
    fetchedAt: new Date().toISOString(),
    men: menShowcase,
    women: womenShowcase,
    wtc,
    warnings: [...rankWarnings, ...wtcWarnings],
  };
}

export function needsRankingsShowcaseRebuild(
  snapshot: RankingsShowcaseSnapshot | null | undefined,
): boolean {
  return !snapshot || snapshot.version !== RANKINGS_SHOWCASE_VERSION;
}

export function logRankingsShowcaseStats(snapshot: RankingsShowcaseSnapshot): void {
  for (const showcase of [snapshot.men, snapshot.women]) {
    for (const f of showcase.formats) {
      console.log(
        `  ${showcase.gender} ${f.format}: ${f.topTeams.length} teams, ` +
          `${f.bangladeshBatters.length} bat, ${f.bangladeshBowlers.length} bowl, ` +
          `${f.bangladeshAllRounders.length} ar`,
      );
    }
  }
  if (snapshot.wtc) {
    console.log(`  wtc: ${snapshot.wtc.topStandings.length} teams (${snapshot.wtc.cycleLabel})`);
  }
}

export type { WtcShowcase };
