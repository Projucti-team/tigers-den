import { isBangladeshTeam } from "@/lib/cricket/constants";
import { fetchWtcStandingsFromEspn } from "@/lib/cricket/providers/wtc-espn";
import {
  readWtcStandingsSnapshot,
  wtcSnapshotAgeHours,
  writeWtcStandingsSnapshot,
} from "@/lib/cricket/wtc-store";
import type { WtcStandingsSnapshot, WtcTeamStanding } from "@/lib/cricket/types";

const MAX_CACHE_AGE_HOURS = 36;

export type WtcShowcase = {
  cycleLabel: string;
  standings: WtcTeamStanding[];
  topStandings: WtcTeamStanding[];
  bangladesh: WtcTeamStanding | null;
};

function findBangladesh(standings: WtcTeamStanding[]): WtcTeamStanding | null {
  return (
    standings.find(
      (t) =>
        isBangladeshTeam(t.team) ||
        isBangladeshTeam(t.abbreviation) ||
        t.abbreviation.toUpperCase() === "BAN",
    ) ?? null
  );
}

export function wtcShowcaseFromSnapshot(snapshot: WtcStandingsSnapshot): WtcShowcase {
  return {
    cycleLabel: snapshot.cycleLabel,
    standings: snapshot.standings,
    topStandings: snapshot.standings.slice(0, 10),
    bangladesh: findBangladesh(snapshot.standings),
  };
}

export async function getWtcStandings(): Promise<{
  wtc: WtcShowcase | null;
  warnings: string[];
}> {
  const warnings: string[] = [];
  const snapshot = await readWtcStandingsSnapshot();

  if (snapshot) {
    const ageH = wtcSnapshotAgeHours(snapshot);
    if (ageH > MAX_CACHE_AGE_HOURS) {
      warnings.push(
        `WTC standings cache is ${Math.round(ageH)}h old. Run \`npm run scrape:wtc-standings\` or wait for the nightly job.`,
      );
    }
    return { wtc: wtcShowcaseFromSnapshot(snapshot), warnings };
  }

  warnings.push("No local WTC file (data/wtc-standings.json). Fetching live…");

  try {
    const live = await fetchWtcStandingsFromEspn();
    await writeWtcStandingsSnapshot(live).catch(() => {
      warnings.push("Could not write WTC cache (read-only filesystem?).");
    });
    return { wtc: wtcShowcaseFromSnapshot(live), warnings };
  } catch {
    warnings.push(
      "WTC standings unavailable. Run `npm run scrape:wtc-standings` to populate data/wtc-standings.json.",
    );
    return { wtc: null, warnings };
  }
}
