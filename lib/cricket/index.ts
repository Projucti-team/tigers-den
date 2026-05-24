import { withCache, CACHE_TTL_MS } from "@/lib/cricket/cache";
import { getLiveCricketData } from "@/lib/cricket/services/live";
import { getRankings } from "@/lib/cricket/services/rankings";
import { getFutureTours } from "@/lib/cricket/services/tours";
import type { CricketDashboard } from "@/lib/cricket/types";

export async function getCricketDashboard(): Promise<CricketDashboard> {
  return withCache("cricket:dashboard", CACHE_TTL_MS, async () => {
    const warnings: string[] = [];
    const providers: string[] = [];

    if (process.env.CRICKET_DATA_API_KEY) providers.push("cricapi");
    if (process.env.CRICKET_JUPITER_API_TOKEN) providers.push("sports-jupiter");
    providers.push("icc-sportz");

    const [toursResult, liveResult, rankingsResult] = await Promise.all([
      getFutureTours({ bangladeshOnly: true }),
      getLiveCricketData(),
      getRankings(),
    ]);

    warnings.push(
      ...toursResult.warnings,
      ...liveResult.warnings,
      ...rankingsResult.warnings,
    );

    return {
      meta: {
        fetchedAt: new Date().toISOString(),
        providers,
        warnings: [...new Set(warnings)],
      },
      tours: toursResult.tours,
      live: {
        matches: liveResult.matches,
        bangladeshMatch: liveResult.bangladeshMatch,
        scorecard: liveResult.scorecard,
      },
      rankings: {
        men: rankingsResult.men,
        women: rankingsResult.women,
      },
    };
  });
}

export * from "@/lib/cricket/types";
export { getFutureTours } from "@/lib/cricket/services/tours";
export { getTourCards } from "@/lib/cricket/services/tours-display";
export { getMatchHighlight, getMatchCentreData } from "@/lib/cricket/services/match-highlight";
export { scrapeBangladeshLastMatch } from "@/lib/cricket/services/bangladesh-last-match";
export { getLiveCricketData } from "@/lib/cricket/services/live";
export { getRankings } from "@/lib/cricket/services/rankings";
export { getRankingsShowcase } from "@/lib/cricket/services/rankings-display";
export { syncCricketSnapshots } from "@/lib/cricket/services/sync-cricket-snapshots";
export { getToursIndexSnapshot } from "@/lib/cricket/services/tours";
