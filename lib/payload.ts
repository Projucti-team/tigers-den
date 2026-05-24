import { getPayload } from "payload";

import config from "@payload-config";
import { ensureCricketSnapshotsTable } from "@/lib/cricket/ensure-snapshot-table";

export function isPayloadConfigured(): boolean {
  return Boolean(process.env.PAYLOAD_SECRET?.trim());
}

export async function getPayloadClient() {
  if (!isPayloadConfigured()) {
    throw new Error("PAYLOAD_SECRET is not configured");
  }
  const payload = await getPayload({ config });
  await ensureCricketSnapshotsTable(payload);
  return payload;
}
