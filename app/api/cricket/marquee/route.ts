import { NextResponse } from "next/server";

import { getMarqueeTickerItems } from "@/lib/cricket/services/marquee-ticker";

export const dynamic = "force-dynamic";

/** Fresh marquee lines — polled by the top ticker during live matches. */
export async function GET() {
  try {
    const items = await getMarqueeTickerItems();
    return NextResponse.json({ items, fetchedAt: new Date().toISOString() });
  } catch {
    return NextResponse.json({ items: [], fetchedAt: new Date().toISOString() }, { status: 500 });
  }
}
