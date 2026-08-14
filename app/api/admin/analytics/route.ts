import { NextResponse } from "next/server";

import { getGaStats24h } from "@/lib/analytics/ga-stats";
import { isGaReportingConfigured } from "@/lib/analytics/ga-config";
import { getPayloadClient } from "@/lib/payload";

export const runtime = "nodejs";

async function requireAdmin(request: Request) {
  const payload = await getPayloadClient();
  const { user } = await payload.auth({ headers: request.headers });
  return user;
}

/** Last-24h GA4 snapshot for the admin dashboard panel. */
export async function GET(request: Request) {
  const user = await requireAdmin(request);
  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized — sign in to Payload admin first." },
      { status: 401 },
    );
  }

  if (!isGaReportingConfigured()) {
    return NextResponse.json(
      {
        configured: false,
        error:
          "GA reporting isn't set up yet — add GA_PROPERTY_ID, GA_CLIENT_EMAIL, and GA_PRIVATE_KEY (see .env.example).",
      },
      { status: 200 },
    );
  }

  try {
    const stats = await getGaStats24h();
    return NextResponse.json({ configured: true, ...stats });
  } catch (err) {
    return NextResponse.json(
      {
        configured: true,
        error: err instanceof Error ? err.message : "Failed to load analytics",
      },
      { status: 500 },
    );
  }
}
