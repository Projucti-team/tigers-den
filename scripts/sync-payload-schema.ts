import { getPayload } from "payload";

import { syncPayloadSchema } from "../lib/payload-sync-schema";
import config from "../payload.config";

async function main() {
  if (!process.env.POSTGRES_URL?.trim() || !process.env.PAYLOAD_SECRET?.trim()) {
    console.log("[payload] Skipping schema sync (POSTGRES_URL or PAYLOAD_SECRET unset).");
    return;
  }

  console.log("[payload] Syncing Postgres schema…");
  const payload = await getPayload({ config });
  await syncPayloadSchema(payload);
  console.log("[payload] Schema sync complete.");
}

main().catch((err) => {
  console.error("[payload] Schema sync failed:", err);
  process.exit(1);
});
