"use client";

import { useEffect, useState } from "react";

type AnalyticsResponse = {
  configured: boolean;
  activeUsers?: number;
  pageViews?: number;
  topPages?: { path: string; views: number }[];
  error?: string;
};

export default function AnalyticsPanel() {
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/admin/analytics", {
          credentials: "include",
          headers: { Accept: "application/json" },
        });
        const body = (await res.json().catch(() => ({}))) as AnalyticsResponse;
        if (!cancelled) setData(body);
      } catch (err) {
        if (!cancelled) {
          setData({
            configured: true,
            error: err instanceof Error ? err.message : "Failed to load analytics",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>📊 Site traffic (last 24h)</h3>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          style={{
            padding: "0.3rem 0.7rem",
            borderRadius: "4px",
            border: "1px solid var(--theme-elevation-150)",
            background: "transparent",
            color: "inherit",
            fontSize: "0.8125rem",
            cursor: "pointer",
          }}
        >
          {collapsed ? "Show" : "Hide"}
        </button>
      </div>

      {collapsed ? null : loading ? (
        <p style={{ fontSize: "0.8125rem", opacity: 0.8, margin: "0.75rem 0 0" }}>Loading…</p>
      ) : !data?.configured ? (
        <p style={{ fontSize: "0.8125rem", opacity: 0.85, margin: "0.75rem 0 0" }}>
          {data?.error ?? "Google Analytics reporting isn't set up yet."}
        </p>
      ) : data.error ? (
        <p style={{ fontSize: "0.8125rem", color: "#c41e24", margin: "0.75rem 0 0" }}>{data.error}</p>
      ) : (
        <>
          <div style={{ display: "flex", gap: "1.5rem", margin: "1rem 0" }}>
            <div>
              <div style={{ fontSize: "1.75rem", fontWeight: 700 }}>{data.activeUsers ?? 0}</div>
              <div style={{ fontSize: "0.75rem", opacity: 0.7 }}>Users</div>
            </div>
            <div>
              <div style={{ fontSize: "1.75rem", fontWeight: 700 }}>{data.pageViews ?? 0}</div>
              <div style={{ fontSize: "0.75rem", opacity: 0.7 }}>Page views</div>
            </div>
          </div>

          {data.topPages?.length ? (
            <div>
              <p style={{ fontSize: "0.75rem", opacity: 0.7, margin: "0 0 0.4rem", textTransform: "uppercase" }}>
                Top pages
              </p>
              <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                {data.topPages.map((p) => (
                  <li
                    key={p.path}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: "1rem",
                      fontSize: "0.8125rem",
                      padding: "0.25rem 0",
                      borderBottom: "1px solid var(--theme-elevation-100)",
                    }}
                  >
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.path}
                    </span>
                    <span style={{ opacity: 0.75, flexShrink: 0 }}>{p.views}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
