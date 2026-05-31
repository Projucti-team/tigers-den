import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { syncCricketSnapshots } from "@/lib/cricket/services/sync-cricket-snapshots";
import { getPayloadClient } from "@/lib/payload";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Legacy alias — prefer POST /api/cricket-snapshots/sync from the admin panel. */
export async function POST() {
  try {
    const payload = await getPayloadClient();
    const headerList = await headers();
    const { user } = await payload.auth({ headers: headerList });

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized — use /api/cricket-snapshots/sync while logged into admin." },
        { status: 401 },
      );
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
