import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { syncCricketSnapshots } from "@/lib/cricket/services/sync-cricket-snapshots";
import { parseCricketSyncJobs } from "@/lib/cricket/sync-jobs";
import { getPayloadClient } from "@/lib/payload";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Admin-only cricket sync — used by the Payload dashboard button. */
export async function POST(request: Request) {
  try {
    const payload = await getPayloadClient();
    const { user } = await payload.auth({ headers: request.headers });

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized — sign in to Payload admin first." },
        { status: 401 },
      );
    }

    const url = new URL(request.url);
    const forceParam = url.searchParams.get("force");
    const force = forceParam !== "0";
    const jobsParam = url.searchParams.get("jobs") ?? url.searchParams.get("job") ?? undefined;
    const jobs = parseCricketSyncJobs(jobsParam);
    const result = await syncCricketSnapshots({ force, jobs });

    if (result.ok) {
      revalidatePath("/");
      revalidatePath("/rankings");
      revalidatePath("/tours");
    }

    return NextResponse.json(result, { status: result.ok ? 200 : 207 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed" },
      { status: 500 },
    );
  }
}
