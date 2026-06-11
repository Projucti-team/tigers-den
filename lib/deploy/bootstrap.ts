import { needsRankingsShowcaseRebuild } from "@/lib/cricket/services/build-rankings-showcase";
import { refreshRankingsShowcase } from "@/lib/cricket/services/rankings-display";
import { CRICKET_SNAPSHOT_KEYS } from "@/lib/cricket/snapshot-keys";
import { getLastCricketSyncFetchedAt, readCricketSnapshot } from "@/lib/cricket/snapshot-db";
import type { RankingsShowcaseSnapshot, ToursIndexSnapshot } from "@/lib/cricket/snapshot-types";
import {
  syncCricketSnapshots,
  type SyncCricketResult,
} from "@/lib/cricket/services/sync-cricket-snapshots";
import { ensurePayloadSchema } from "@/lib/payload-ensure-schema";
import { hasPersistedDatabase, isProductionDatabase } from "@/lib/payload-db";
import { isPayloadConfigured } from "@/lib/payload";
import config from "@payload-config";
import { getPayload } from "payload";

export type DeployBootstrapResult = {
  migrations: "ok" | "skipped";
  cricketSync: "ran" | "skipped" | "failed";
  cricketSyncResult?: SyncCricketResult;
  errors: string[];
};

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

  if (!hasPersistedDatabase()) {
    return {
      migrations: "skipped",
      cricketSync: "skipped",
      errors: [
        "No database configured — set DATABASE_URI (VPS/Docker) or POSTGRES_URL (Vercel).",
      ],
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
  const [toursSnapshot, rankingsSnapshot] = await Promise.all([
    readCricketSnapshot<ToursIndexSnapshot>(CRICKET_SNAPSHOT_KEYS.toursIndex),
    readCricketSnapshot<RankingsShowcaseSnapshot>(CRICKET_SNAPSHOT_KEYS.rankingsShowcase),
  ]);
  const hasTours = (toursSnapshot?.tours?.length ?? 0) > 0;
  const rankingsCurrent = !needsRankingsShowcaseRebuild(rankingsSnapshot);

  if (!forceSync && lastSync && hasTours && rankingsCurrent) {
    return { migrations: "ok", cricketSync: "skipped", errors: [] };
  }

  if (!forceSync && hasTours && !rankingsCurrent) {
    try {
      await refreshRankingsShowcase();
      return { migrations: "ok", cricketSync: "ran", errors: [] };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Rankings rebuild failed";
      errors.push(message);
    }
  }

  if (!process.env.CRICKET_DATA_API_KEY?.trim()) {
    errors.push(
      "CRICKET_DATA_API_KEY is not set — migrations ran but cricket snapshots were not synced.",
    );
    return { migrations: "ok", cricketSync: "skipped", errors };
  }

  const cricketSyncResult = await syncCricketSnapshots({ force: forceSync });
  if (!cricketSyncResult.ok) {
    errors.push(...cricketSyncResult.errors);
    return { migrations: "ok", cricketSync: "failed", cricketSyncResult, errors };
  }

  if (cricketSyncResult.warnings.length > 0) {
    console.warn("[deploy-bootstrap] cricket warnings:", cricketSyncResult.warnings.join("; "));
  }

  return { migrations: "ok", cricketSync: "ran", cricketSyncResult, errors: [] };
}
