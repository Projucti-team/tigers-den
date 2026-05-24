import { getPayload } from "payload";

import config from "@payload-config";

export function isPayloadConfigured(): boolean {
  return Boolean(process.env.PAYLOAD_SECRET?.trim());
}

export async function getPayloadClient() {
  if (!isPayloadConfigured()) {
    throw new Error("PAYLOAD_SECRET is not configured");
  }
  return getPayload({ config });
}
