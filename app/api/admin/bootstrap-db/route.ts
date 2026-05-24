import { NextResponse } from "next/server";
import { getPayload } from "payload";

import config from "@payload-config";
import { ensurePayloadSchema } from "@/lib/payload-ensure-schema";
import { isPayloadConfigured } from "@/lib/payload";

export const maxDuration = 60;

/** One-off Postgres schema sync when admin views fail (protected by CRON_SECRET). */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isPayloadConfigured() || !process.env.POSTGRES_URL) {
    return NextResponse.json(
      { error: "PAYLOAD_SECRET and POSTGRES_URL are required" },
      { status: 503 },
    );
  }

  try {
    const payload = await getPayload({ config });
    await ensurePayloadSchema(payload);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Schema sync failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
