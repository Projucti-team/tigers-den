import { fetchScorecard, isCricApiConfigured } from "@/lib/cricket/providers/cricapi";
import { cricketError, cricketJson } from "@/lib/cricket/api-response";

export const dynamic = "force-dynamic";

/** GET /api/cricket/scorecard/:matchId */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ matchId: string }> },
) {
  try {
    const { matchId } = await params;

    if (!isCricApiConfigured()) {
      return cricketError("CRICKET_DATA_API_KEY is not set", 503);
    }

    const scorecard = await fetchScorecard(matchId);
    return cricketJson({
      data: { scorecard },
      meta: { fetchedAt: new Date().toISOString() },
    });
  } catch (e) {
    return cricketError(e instanceof Error ? e.message : "Failed to fetch scorecard", 500);
  }
}
