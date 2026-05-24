import { getLastCricketSyncFetchedAt } from "@/lib/cricket/snapshot-db";
import {
  syncCricketSnapshots,
  type SyncCricketResult,
} from "@/lib/cricket/services/sync-cricket-snapshots";
import { ensurePayloadSchema } from "@/lib/payload-ensure-schema";
import { isPayloadConfigured } from "@/lib/payload";
import config from "@payload-config";
import { getPayload } from "payload";

export type DeployBootstrapResult = {
  migrations: "ok" | "skipped";
  cricketSync: "ran" | "skipped" | "failed";
  cricketSyncResult?: SyncCricketResult;
  errors: string[];
};

function hasProductionDatabase(): boolean {
  return Boolean(process.env.POSTGRES_URL?.trim() || process.env.DATABASE_URL?.trim());
}

/**
 * Idempotent production setup: SQL migrations, then cricket snapshots if missing.
 * Called from /api/admin/bootstrap-db and during Vercel builds (via deploy:seed).
 */
export async function runDeployBootstrap(options?: {
  forceCricketSync?: boolean;
}): Promise<DeployBootstrapResult> {
  const errors: string[] = [];

  if (!isPayloadConfigured()) {
    return {
      migrations: "skipped",
      cricketSync: "skipped",
      errors: ["PAYLOAD_SECRET is not set — skipping deploy bootstrap."],
    };
  }

  if (!hasProductionDatabase()) {
    return {
      migrations: "skipped",
      cricketSync: "skipped",
      errors: ["POSTGRES_URL is not set — skipping deploy bootstrap (local SQLite builds)."],
    };
  }

  const payload = await getPayload({ config });

  try {
    await ensurePayloadSchema(payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    errors.push(`Schema migration failed: ${message}`);
    return { migrations: "skipped", cricketSync: "skipped", errors };
  }

  const forceSync = options?.forceCricketSync === true;
  const lastSync = await getLastCricketSyncFetchedAt();
  if (!forceSync && lastSync) {
    return { migrations: "ok", cricketSync: "skipped", errors: [] };
  }

  if (!process.env.CRICKET_DATA_API_KEY?.trim()) {
    errors.push(
      "CRICKET_DATA_API_KEY is not set — migrations ran but cricket snapshots were not synced.",
    );
    return { migrations: "ok", cricketSync: "skipped", errors };
  }

  const cricketSyncResult = await syncCricketSnapshots();
  if (!cricketSyncResult.ok) {
    errors.push(...cricketSyncResult.errors);
    return { migrations: "ok", cricketSync: "failed", cricketSyncResult, errors };
  }

  if (cricketSyncResult.warnings.length > 0) {
    console.warn("[deploy-bootstrap] cricket warnings:", cricketSyncResult.warnings.join("; "));
  }

  return { migrations: "ok", cricketSync: "ran", cricketSyncResult, errors: [] };
}
