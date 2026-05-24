import { FORMATS, isBangladeshTeam } from "@/lib/cricket/constants";
import {
  readIccRankingsSnapshot,
  snapshotAgeHours,
  writeIccRankingsSnapshot,
} from "@/lib/cricket/icc-rankings-store";
import { fetchAllIccRankingsFromSportz } from "@/lib/cricket/providers/icc-sportz";
import type { IccRankingsSnapshot } from "@/lib/cricket/providers/icc-sportz";
import type { GenderRankings } from "@/lib/cricket/types";

const MAX_CACHE_AGE_HOURS = 36;

function findBangladesh(teams: GenderRankings["teams"]["test"]) {
  return (
    teams.find(
      (t) =>
        isBangladeshTeam(t.name) ||
        isBangladeshTeam(t.abbreviation) ||
        t.abbreviation.toUpperCase() === "BAN" ||
        t.abbreviation.toUpperCase() === "BD",
    ) ?? null
  );
}

/** Recompute bangladesh slots from team lists (in case snapshot was partial). */
export function normalizeGenderRankings(data: GenderRankings): GenderRankings {
  const bangladesh = {} as GenderRankings["bangladesh"];
  for (const format of FORMATS) {
    bangladesh[format] = findBangladesh(data.teams[format]);
  }
  return { ...data, bangladesh };
}

export function rankingsFromIccSnapshot(snapshot: IccRankingsSnapshot): {
  men: GenderRankings;
  women: GenderRankings;
} {
  return {
    men: normalizeGenderRankings(snapshot.men),
    women: normalizeGenderRankings(snapshot.women),
  };
}

export async function getRankings(): Promise<{
  men: GenderRankings;
  women: GenderRankings;
  warnings: string[];
}> {
  const warnings: string[] = [];
  const snapshot = await readIccRankingsSnapshot();

  if (snapshot) {
    const ageH = snapshotAgeHours(snapshot);
    if (ageH > MAX_CACHE_AGE_HOURS) {
      warnings.push(
        `ICC rankings cache is ${Math.round(ageH)}h old. Run \`npm run scrape:icc-rankings\` or wait for the nightly job.`,
      );
    }
    return {
      men: normalizeGenderRankings(snapshot.men),
      women: normalizeGenderRankings(snapshot.women),
      warnings,
    };
  }

  warnings.push(
    "No local ICC rankings file (data/icc-rankings.json). Fetching live from icc-cricket.com…",
  );

  try {
    const live = await fetchAllIccRankingsFromSportz();
    await writeIccRankingsSnapshot(live).catch(() => {
      warnings.push("Could not write rankings cache (read-only filesystem?).");
    });
    return {
      men: normalizeGenderRankings(live.men),
      women: normalizeGenderRankings(live.women),
      warnings,
    };
  } catch {
    warnings.push(
      "ICC rankings unavailable. Run `npm run scrape:icc-rankings` to populate data/icc-rankings.json.",
    );
    const empty = (gender: "men" | "women"): GenderRankings => ({
      gender,
      teams: { test: [], odi: [], t20: [] },
      bangladesh: { test: null, odi: null, t20: null },
      players: {
        test: {
          format: "test",
          topBatsmen: [],
          topBowlers: [],
          topAllRounders: [],
          topBangladeshBatsman: null,
          topBangladeshBowler: null,
          topBangladeshAllRounder: null,
        },
        odi: {
          format: "odi",
          topBatsmen: [],
          topBowlers: [],
          topAllRounders: [],
          topBangladeshBatsman: null,
          topBangladeshBowler: null,
          topBangladeshAllRounder: null,
        },
        t20: {
          format: "t20",
          topBatsmen: [],
          topBowlers: [],
          topAllRounders: [],
          topBangladeshBatsman: null,
          topBangladeshBowler: null,
          topBangladeshAllRounder: null,
        },
      },
    });
    return { men: empty("men"), women: empty("women"), warnings };
  }
}
