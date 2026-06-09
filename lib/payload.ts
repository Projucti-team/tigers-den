import { getPayload } from "payload";

import config from "@payload-config";
import { ensurePostgresPayloadSchema } from "@/lib/payload-ensure-postgres-schema";
import { ensurePayloadSchema } from "@/lib/payload-ensure-schema";
import { isPostgresDatabase } from "@/lib/payload-postgres-url";

export function isPayloadConfigured(): boolean {
  return Boolean(process.env.PAYLOAD_SECRET?.trim());
}

let payloadReady: Promise<Awaited<ReturnType<typeof getPayload>>> | null = null;

export async function getPayloadClient() {
  if (!isPayloadConfigured()) {
    throw new Error("PAYLOAD_SECRET is not configured");
  }

  if (!payloadReady) {
    payloadReady = (async () => {
      if (isPostgresDatabase()) {
        await ensurePostgresPayloadSchema();
      }
      const payload = await getPayload({ config });
      await ensurePayloadSchema(payload);
      return payload;
    })().catch((err) => {
      payloadReady = null;
      throw err;
    });
  }

  return payloadReady;
}
