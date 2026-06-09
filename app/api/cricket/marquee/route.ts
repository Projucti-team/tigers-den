import { NextResponse } from "next/server";

import { getMarqueeTickerSnapshot } from "@/lib/cricket/services/marquee-ticker";

export const dynamic = "force-dynamic";

/** Fresh marquee lines — polled by the top ticker during live matches. */
export async function GET() {
  try {
    const { items, isLive } = await getMarqueeTickerSnapshot();
    return NextResponse.json({ items, isLive, fetchedAt: new Date().toISOString() });
  } catch {
    return NextResponse.json(
      { items: [], isLive: false, fetchedAt: new Date().toISOString() },
      { status: 500 },
    );
  }
}
