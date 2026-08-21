"use client";

import { Button } from "@payloadcms/ui";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import type { SyncCricketResult } from "@/lib/cricket/services/sync-cricket-snapshots";
import {
  CRICKET_SYNC_JOBS,
  type CricketSyncJobSelection,
} from "@/lib/cricket/sync-jobs";

type SyncState =
  | { status: "idle" }
  | { status: "running"; job: CricketSyncJobSelection }
  | { status: "done"; job: CricketSyncJobSelection; result: SyncCricketResult }
  | { status: "error"; job: CricketSyncJobSelection; message: string };

type JobRunInfo = {
  job_id: string;
  last_run_at: string | null;
  last_success_at: string | null;
  last_ok: boolean | null;
  last_warnings: string[] | null;
  last_errors: string[] | null;
};

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const diffMs = Date.now() - then;
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function JobLastRun({ info }: { info: JobRunInfo | undefined }) {
  if (!info || (!info.last_run_at && !info.last_success_at)) {
    return <span style={{ opacity: 0.6 }}>never run</span>;
  }

  if (info.last_ok && info.last_success_at) {
    return (
      <span style={{ color: "#0a7a52" }}>
        ✓ last ran {formatRelative(info.last_success_at)}
      </span>
    );
  }

  const attempted = info.last_run_at ? formatRelative(info.last_run_at) : "recently";
  return (
    <span style={{ color: "#c41e24" }}>
      ✕ failed {attempted}
      {info.last_success_at ? ` (last success ${formatRelative(info.last_success_at)})` : ""}
    </span>
  );
}

export default function CricketSyncPanel() {
  const router = useRouter();
  const [state, setState] = useState<SyncState>({ status: "idle" });
  const [lastRuns, setLastRuns] = useState<Record<string, JobRunInfo> | null>(null);

  async function fetchLastRuns() {
    try {
      const res = await fetch("/api/cricket-snapshots/sync/last-runs", {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) return;
      const body = (await res.json().catch(() => null)) as Record<string, JobRunInfo> | null;
      if (body) setLastRuns(body);
    } catch {
      // Best-effort — the sync buttons still work without this.
    }
  }

  useEffect(() => {
    void fetchLastRuns();
  }, []);

  async function runSync(job: CricketSyncJobSelection) {
    setState({ status: "running", job });

    const params = new URLSearchParams({ force: "1" });
    if (job !== "all") {
      params.set("jobs", job);
    }

    try {
      // Payload's own /cricket-snapshots/sync endpoint (session-cookie authed) — starts the
      // sync in the background and returns 202 immediately, avoiding proxy timeouts on longer
      // syncs. /api/admin/cricket-sync waits for full completion, which can exceed the reverse
      // proxy's timeout even though the sync itself succeeds.
      const res = await fetch(`/api/cricket-snapshots/sync?${params.toString()}`, {
        method: "POST",
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      const body = (await res.json().catch(() => ({}))) as SyncCricketResult & {
        error?: string;
        status?: string;
        message?: string;
      };

      if (res.status === 202 || body.status === "started" || body.status === "running") {
        const result = await pollSyncStatus();
        if (result) {
          setState({ status: "done", job, result });
          router.refresh();
          void fetchLastRuns();
          return;
        }
        setState({
          status: "error",
          job,
          message: "Sync did not finish — check server logs or run ./scripts/prod-cricket-sync.sh on the VPS.",
        });
        void fetchLastRuns();
        return;
      }

      if (!res.ok) {
        const detail =
          body.error ??
          (Array.isArray(body.errors) && body.errors.length > 0
            ? body.errors.join("; ")
            : null);
        setState({
          status: "error",
          job,
          message: detail ?? `Sync failed (HTTP ${res.status})`,
        });
        void fetchLastRuns();
        return;
      }

      setState({ status: "done", job, result: body });
      router.refresh();
      void fetchLastRuns();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sync failed";
      setState({ status: "error", job, message });
      void fetchLastRuns();
    }
  }

  async function pollSyncStatus(): Promise<SyncCricketResult | null> {
    const deadline = Date.now() + 10 * 60 * 1000;

    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 5000));

      const res = await fetch("/api/cricket-snapshots/sync/status", {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      const lock = (await res.json().catch(() => ({}))) as {
        inProgress?: boolean;
        lastResult?: SyncCricketResult;
        lastError?: string | null;
      };

      if (lock.inProgress) continue;
      if (lock.lastResult) return lock.lastResult;
      if (lock.lastError) {
        throw new Error(lock.lastError);
      }
    }

    return null;
  }

  const runningJob = state.status === "running" ? state.job : null;
  const lastJob = state.status === "done" || state.status === "error" ? state.job : null;

  return (
    <div
      style={{
        marginBottom: "1.5rem",
        padding: "1.25rem 1.5rem",
        borderRadius: "8px",
        border: "1px solid var(--theme-elevation-150)",
        background: "var(--theme-elevation-50)",
      }}
    >
      <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>Cricket data sync</h3>
      <p style={{ margin: "0.5rem 0 1rem", fontSize: "0.875rem", opacity: 0.85 }}>
        Refresh rankings, tours, squads, and match snapshots from live sources. Runs automatically
        nightly between 3:00–4:00 AM BDT. Run all after deploy, or pick a single job when you only
        need to refresh one area.
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1rem" }}>
        {CRICKET_SYNC_JOBS.map((entry) => {
          const isRunning = runningJob === entry.id;
          const isPrimary = entry.id === "all";

          return (
            <div key={entry.id} style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              <Button
                buttonStyle={isPrimary ? "primary" : "secondary"}
                disabled={Boolean(runningJob)}
                onClick={() => void runSync(entry.id)}
              >
                {isRunning ? `Running ${entry.label}…` : entry.label}
              </Button>
              {!isPrimary ? (
                <span style={{ fontSize: "0.75rem", textAlign: "center" }}>
                  <JobLastRun info={lastRuns?.[entry.id]} />
                </span>
              ) : null}
            </div>
          );
        })}
      </div>

      <ul
        style={{
          margin: 0,
          paddingLeft: "1.25rem",
          fontSize: "0.8125rem",
          opacity: 0.9,
          display: "grid",
          gap: "0.35rem",
        }}
      >
        {CRICKET_SYNC_JOBS.filter((entry) => entry.id !== "all").map((entry) => (
          <li key={entry.id}>
            <strong>{entry.label}</strong> — {entry.description}
          </li>
        ))}
      </ul>

      {state.status === "done" ? (
        <div style={{ marginTop: "1rem", fontSize: "0.8125rem" }}>
          <p style={{ margin: 0, fontWeight: 600, color: state.result.ok ? "#0a7a52" : "#c41e24" }}>
            {state.result.ok ? "Sync completed" : "Sync finished with errors"}
            {lastJob && lastJob !== "all"
              ? ` (${CRICKET_SYNC_JOBS.find((j) => j.id === lastJob)?.label ?? lastJob})`
              : ""}
          </p>
          <p style={{ margin: "0.35rem 0 0", opacity: 0.9 }}>
            Jobs: {state.result.jobsRun.join(", ")}
            {state.result.toursCount > 0 || state.result.tourDetailsCount > 0
              ? ` · Tours: ${state.result.toursCount}, tour details: ${state.result.tourDetailsCount}`
              : ""}{" "}
            · {new Date(state.result.fetchedAt).toLocaleString("en-GB")}
          </p>
          {state.result.warnings.length > 0 ? (
            <ul style={{ margin: "0.5rem 0 0", paddingLeft: "1.25rem" }}>
              {state.result.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          ) : null}
          {state.result.errors.length > 0 ? (
            <ul style={{ margin: "0.5rem 0 0", paddingLeft: "1.25rem", color: "#c41e24" }}>
              {state.result.errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {state.status === "error" ? (
        <p style={{ margin: "0.75rem 0 0", fontSize: "0.8125rem", color: "#c41e24" }}>
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
