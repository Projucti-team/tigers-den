"use client";

import { Button } from "@payloadcms/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { SyncCricketResult } from "@/lib/cricket/services/sync-cricket-snapshots";

type SyncState =
  | { status: "idle" }
  | { status: "running" }
  | { status: "done"; result: SyncCricketResult }
  | { status: "error"; message: string };

export default function CricketSyncPanel() {
  const router = useRouter();
  const [state, setState] = useState<SyncState>({ status: "idle" });

  async function runSync() {
    setState({ status: "running" });

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 5 * 60 * 1000);

    try {
      const res = await fetch("/api/cricket-snapshots/sync?force=1", {
        method: "POST",
        credentials: "include",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      const body = (await res.json().catch(() => ({}))) as SyncCricketResult & {
        error?: string;
      };

      if (!res.ok) {
        const detail =
          body.error ??
          (Array.isArray(body.errors) && body.errors.length > 0
            ? body.errors.join("; ")
            : null);
        setState({
          status: "error",
          message: detail ?? `Sync failed (HTTP ${res.status})`,
        });
        return;
      }

      setState({ status: "done", result: body });
      router.refresh();
    } catch (err) {
      const message =
        err instanceof Error && err.name === "AbortError"
          ? "Sync timed out after 5 minutes — try again or use ./scripts/prod-cricket-sync.sh on the server."
          : err instanceof Error
            ? err.message
            : "Sync failed";
      setState({ status: "error", message });
    } finally {
      window.clearTimeout(timeout);
    }
  }

  const running = state.status === "running";

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
        nightly between 3:00–4:00 AM BDT; use this after deploy or when pages look stale. May take 1–3
        minutes.
      </p>

      <Button buttonStyle="primary" disabled={running} onClick={() => void runSync()}>
        {running ? "Syncing cricket data…" : "Run cricket sync now"}
      </Button>

      {state.status === "done" ? (
        <div style={{ marginTop: "1rem", fontSize: "0.8125rem" }}>
          <p style={{ margin: 0, fontWeight: 600, color: state.result.ok ? "#0a7a52" : "#c41e24" }}>
            {state.result.ok ? "Sync completed" : "Sync finished with errors"}
          </p>
          <p style={{ margin: "0.35rem 0 0", opacity: 0.9 }}>
            Tours: {state.result.toursCount}, tour details: {state.result.tourDetailsCount} ·{" "}
            {new Date(state.result.fetchedAt).toLocaleString("en-GB")}
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
