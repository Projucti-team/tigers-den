import { after } from "next/server";
import { NextResponse } from "next/server";

import {
  readSyncLock,
  releaseSyncLock,
  runCricketSyncInBackground,
  tryAcquireSyncLock,
} from "@/lib/cricket/services/sync-lock";
import {
  logSyncResult,
  syncCricketSnapshots,
} from "@/lib/cricket/services/sync-cricket-snapshots";
import { parseCricketSyncJobs, resolveCricketSyncJobs } from "@/lib/cricket/sync-jobs";

export const runtime = "nodejs";
export const maxDuration = 300;

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return process.env.NODE_ENV === "development";
  }

  const auth = request.headers.get("authorization")?.trim();
  if (auth === `Bearer ${secret}` || auth === secret) return true;

  const url = new URL(request.url);
  if (url.searchParams.get("secret") === secret) return true;

  return false;
}

function syncOptionsFromRequest(request: Request) {
  const url = new URL(request.url);
  const force = url.searchParams.get("force") === "1";
  const jobsParam = url.searchParams.get("jobs") ?? url.searchParams.get("job") ?? undefined;
  const jobs = parseCricketSyncJobs(jobsParam);
  return { force, jobs };
}

/** Nightly refresh — 21:00 UTC (= 3:00 AM BDT). Returns immediately to avoid Cloudflare 524 timeouts. */
export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  if (url.searchParams.get("status") === "1") {
    const lock = await readSyncLock();
    return NextResponse.json(
      lock ?? { inProgress: false, fetchedAt: null, startedAt: null },
    );
  }

  const { force, jobs } = syncOptionsFromRequest(request);
  const wait = url.searchParams.get("wait") === "1";

  if (wait) {
    if (!(await tryAcquireSyncLock())) {
      return NextResponse.json(
        { status: "running", message: "Sync already in progress" },
        { status: 409 },
      );
    }

    try {
      const result = await syncCricketSnapshots({ force, jobs });
      await releaseSyncLock(result);
      logSyncResult(result);
      return NextResponse.json(result, { status: result.ok ? 200 : 207 });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sync failed";
      await releaseSyncLock(undefined, message);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  const background = await runCricketSyncInBackground({ force, jobs });
  if (background.alreadyRunning) {
    return NextResponse.json(
      {
        status: "running",
        message: "Cricket sync already in progress. Poll ?status=1 for completion.",
        jobs: resolveCricketSyncJobs(jobs),
      },
      { status: 202 },
    );
  }

  after(() => {
    // Keeps the route alive on serverless hosts until the background task is scheduled.
  });

  return NextResponse.json(
    {
      status: "started",
      message:
        "Cricket sync running in background. Poll GET ?status=1 until inProgress is false.",
      force,
      jobs: resolveCricketSyncJobs(jobs),
    },
    { status: 202 },
  );
}

export async function POST(request: Request) {
  return GET(request);
}
