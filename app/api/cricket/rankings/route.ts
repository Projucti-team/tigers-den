import { getRankings } from "@/lib/cricket";
import { cricketError, cricketJson } from "@/lib/cricket/api-response";

export const dynamic = "force-dynamic";

/** GET /api/cricket/rankings — ICC team & player rankings (men + women) */
export async function GET() {
  try {
    const { men, women, warnings } = await getRankings();
    return cricketJson({
      data: { men, women },
      meta: { fetchedAt: new Date().toISOString(), warnings },
    });
  } catch (e) {
    return cricketError(e instanceof Error ? e.message : "Failed to fetch rankings", 500);
  }
}
