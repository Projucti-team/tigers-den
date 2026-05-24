import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { syncCricketSnapshots } from "@/lib/cricket/services/sync-cricket-snapshots";
import { getPayloadClient } from "@/lib/payload";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Admin-only: run the same job as /api/cron/cricket (no CRON_SECRET needed). */
export async function POST() {
  try {
    const payload = await getPayloadClient();
    const { user } = await payload.auth({ headers: await headers() });

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await syncCricketSnapshots();

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
