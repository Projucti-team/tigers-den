import { getCricketDashboard } from "@/lib/cricket";
import { cricketError, cricketJson } from "@/lib/cricket/api-response";

export const dynamic = "force-dynamic";

/** GET /api/cricket — full dashboard (tours, live, rankings men & women) */
export async function GET() {
  try {
    const data = await getCricketDashboard();
    return cricketJson({ data });
  } catch (e) {
    return cricketError(e instanceof Error ? e.message : "Cricket API error", 500);
  }
}
