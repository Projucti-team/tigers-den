import { cricketError, cricketJson } from "@/lib/cricket/api-response";
import { fetchScorecardForMatch } from "@/lib/cricket/services/scorecard";

export const dynamic = "force-dynamic";

/** GET /api/cricket/scorecard/:matchId — ESPNcricinfo ball-by-ball scorecard */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ matchId: string }> },
) {
  try {
    const { matchId } = await params;
    const scorecard = await fetchScorecardForMatch(matchId);
    return cricketJson({
      data: { scorecard },
      meta: { fetchedAt: new Date().toISOString(), source: "espn" },
    });
  } catch (e) {
    return cricketError(e instanceof Error ? e.message : "Failed to fetch scorecard", 500);
  }
}
