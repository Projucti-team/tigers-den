import { NextResponse } from "next/server";

import { getMatchCentreData } from "@/lib/cricket/services/match-highlight";

export const dynamic = "force-dynamic";

/** Live match centre payload — polled during live play. Supports ?matchId= for multi-live switching. */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const matchId = url.searchParams.get("matchId") ?? undefined;
    const data = await getMatchCentreData(matchId);
    return NextResponse.json({ ...data, fetchedAt: new Date().toISOString() });
  } catch {
    return NextResponse.json(
      {
        highlight: null,
        liveMatches: [],
        scorecard: null,
        liveFeed: null,
        weather: null,
        fetchedAt: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
