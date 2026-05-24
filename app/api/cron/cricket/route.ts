import { NextResponse } from "next/server";

import { syncCricketSnapshots } from "@/lib/cricket/services/sync-cricket-snapshots";

export const runtime = "nodejs";
export const maxDuration = 300;

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;

  const auth = request.headers.get("authorization");
  if (secret && auth === `Bearer ${secret}`) return true;

  const url = new URL(request.url);
  if (secret && url.searchParams.get("secret") === secret) return true;

  // Local dev without CRON_SECRET configured
  if (!secret && process.env.NODE_ENV === "development") return true;

  return false;
}

/** Nightly refresh — schedule 21:00 UTC (= 3:00 AM Bangladesh time). */
export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncCricketSnapshots();
    return NextResponse.json(result, { status: result.ok ? 200 : 207 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  return GET(request);
}
