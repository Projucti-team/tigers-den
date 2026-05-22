import { getFutureTours } from "@/lib/cricket";
import { cricketError, cricketJson } from "@/lib/cricket/api-response";

export const dynamic = "force-dynamic";

/** GET /api/cricket/tours?bangladeshOnly=true */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const bangladeshOnly = searchParams.get("bangladeshOnly") !== "false";

    const { tours, warnings } = await getFutureTours({ bangladeshOnly });

    return cricketJson({
      data: { tours },
      meta: { fetchedAt: new Date().toISOString(), warnings },
    });
  } catch (e) {
    return cricketError(e instanceof Error ? e.message : "Failed to fetch tours", 500);
  }
}
