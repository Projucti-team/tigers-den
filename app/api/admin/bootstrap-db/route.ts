import { NextResponse } from "next/server";

import { runDeployBootstrap } from "@/lib/deploy/bootstrap";
import { hasPersistedDatabase } from "@/lib/payload-db";
import { isPayloadConfigured } from "@/lib/payload-env";

export const maxDuration = 300;
export const runtime = "nodejs";

/** Migrations + cricket snapshot seed (protected by CRON_SECRET). */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isPayloadConfigured() || !hasPersistedDatabase()) {
    return NextResponse.json(
      { error: "PAYLOAD_SECRET and a database (DATABASE_URI or POSTGRES_URL) are required" },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  const forceCricketSync = url.searchParams.get("forceCricketSync") === "1";

  try {
    const result = await runDeployBootstrap({ forceCricketSync });
    const ok = result.migrations === "ok" && result.cricketSync !== "failed";
    return NextResponse.json({ ok, ...result }, { status: ok ? 200 : 207 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bootstrap failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
