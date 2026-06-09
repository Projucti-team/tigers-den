import { NextResponse } from "next/server";

import { getMatchCentreData } from "@/lib/cricket/services/match-highlight";

export const dynamic = "force-dynamic";

/** Live match centre payload — polled during live play. */
export async function GET() {
  try {
    const data = await getMatchCentreData();
    return NextResponse.json({ ...data, fetchedAt: new Date().toISOString() });
  } catch {
    return NextResponse.json(
      { highlight: null, scorecard: null, liveFeed: null, fetchedAt: new Date().toISOString() },
      { status: 500 },
    );
  }
}
