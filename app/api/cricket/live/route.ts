import { getLiveCricketData } from "@/lib/cricket";
import { cricketError, cricketJson } from "@/lib/cricket/api-response";

export const dynamic = "force-dynamic";

/** GET /api/cricket/live — current matches + Bangladesh scorecard */
export async function GET() {
  try {
    const result = await getLiveCricketData();
    return cricketJson({
      data: result,
      meta: { fetchedAt: new Date().toISOString(), warnings: result.warnings },
    });
  } catch (e) {
    return cricketError(e instanceof Error ? e.message : "Failed to fetch live data", 500);
  }
}
