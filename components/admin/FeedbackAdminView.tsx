"use client";

import { Button } from "@payloadcms/ui";
import { useEffect, useState } from "react";

type FeedbackRow = {
  id: number;
  title: string;
  description: string;
  category: "bug" | "feature" | "other";
  image_id: number | null;
  image_url: string | null;
  page_url: string;
  user_id: number | null;
  email: string | null;
  name: string | null;
  status: string;
  status_timeline: { status: string; changedAt: string; note?: string }[];
  created_at: string;
  updated_at: string;
};

const STATUS_OPTIONS = [
  "new",
  "under_review",
  "ticket_raised",
  "in_progress",
  "resolved",
  "dismissed",
] as const;

const STATUS_LABEL: Record<string, string> = {
  new: "New",
  under_review: "Under review",
  ticket_raised: "Ticket raised",
  in_progress: "In progress",
  resolved: "Resolved",
  dismissed: "Dismissed",
};

const CATEGORY_EMOJI: Record<string, string> = {
  bug: "🐛",
  feature: "✨",
  other: "💬",
};

const STATUS_COLOR: Record<string, string> = {
  new: "#c41e24",
  under_review: "#b8860b",
  ticket_raised: "#0a5ca8",
  in_progress: "#0a5ca8",
  resolved: "#00875a",
  dismissed: "#6b7280",
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export default function FeedbackAdminView() {
  const [rows, setRows] = useState<FeedbackRow[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [statusFilter, setStatusFilter] = useState<string>("new");
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<number, string>>({});
  const [statusDrafts, setStatusDrafts] = useState<Record<number, string>>({});
  const [savingId, setSavingId] = useState<number | null>(null);
  const [savedId, setSavedId] = useState<number | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  async function load(status: string) {
    setError(null);
    try {
      const qs = status === "all" ? "" : `?status=${status}`;
      const res = await fetch(`/api/admin/feedback${qs}`, {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      const body = (await res.json().catch(() => ({}))) as {
        rows?: FeedbackRow[];
        counts?: Record<string, number>;
        error?: string;
      };
      if (!res.ok) throw new Error(body.error ?? `Failed to load (HTTP ${res.status})`);
      setRows(body.rows ?? []);
      setCounts(body.counts ?? {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load feedback");
    }
  }

  useEffect(() => {
    void load(statusFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  async function saveStatus(id: number) {
    const status = statusDrafts[id];
    if (!status) return;
    setSavingId(id);
    setError(null);
    try {
      const res = await fetch("/api/admin/feedback", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ id, status, note: noteDrafts[id] ?? "" }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? `Save failed (HTTP ${res.status})`);
      await load(statusFilter);
      setSavedId(id);
      setTimeout(() => setSavedId((cur) => (cur === id ? null : cur)), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSavingId(null);
    }
  }

  const totalOpen = (counts.new ?? 0) + (counts.under_review ?? 0) + (counts.ticket_raised ?? 0) + (counts.in_progress ?? 0);

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
        <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>
          🐛 Feedback{totalOpen > 0 ? ` (${totalOpen} open)` : ""}
        </h3>
        <Button buttonStyle="secondary" size="small" onClick={() => setCollapsed((c) => !c)}>
          {collapsed ? "Show" : "Hide"}
        </Button>
      </div>

      {collapsed ? null : (
        <>
          <p style={{ margin: "0.5rem 0 1rem", fontSize: "0.875rem", opacity: 0.85 }}>
            Bug reports and feedback submitted via the site's feedback button.
          </p>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "1rem" }}>
            {["all", ...STATUS_OPTIONS].map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                style={{
                  padding: "0.3rem 0.7rem",
                  borderRadius: "999px",
                  border: `1px solid ${statusFilter === status ? "var(--theme-elevation-800)" : "var(--theme-elevation-150)"}`,
                  background: statusFilter === status ? "var(--theme-elevation-800)" : "transparent",
                  color: statusFilter === status ? "var(--theme-elevation-0)" : "inherit",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {status === "all" ? "All" : STATUS_LABEL[status]}
                {status !== "all" && counts[status] ? ` (${counts[status]})` : ""}
              </button>
            ))}
          </div>

          {error ? (
            <p style={{ margin: "0 0 0.75rem", fontSize: "0.8125rem", color: "#c41e24" }}>{error}</p>
          ) : null}

          {!rows ? (
            <p style={{ fontSize: "0.8125rem", opacity: 0.8 }}>Loading…</p>
          ) : rows.length === 0 ? (
            <p style={{ fontSize: "0.8125rem", opacity: 0.8 }}>Nothing here.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              {rows.map((row) => {
                const isExpanded = expandedId === row.id;
                const statusDraft = statusDrafts[row.id] ?? row.status;
                return (
                  <div
                    key={row.id}
                    style={{
                      border: "1px solid var(--theme-elevation-150)",
                      borderRadius: "6px",
                      background: "var(--theme-input-bg, var(--theme-bg))",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : row.id)}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "0.75rem",
                        padding: "0.6rem 0.8rem",
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        textAlign: "left",
                        color: "inherit",
                      }}
                    >
                      <span style={{ display: "flex", alignItems: "center", gap: "0.5rem", minWidth: 0 }}>
                        <span aria-hidden>{CATEGORY_EMOJI[row.category] ?? "💬"}</span>
                        <span
                          style={{
                            fontWeight: 600,
                            fontSize: "0.875rem",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {row.title}
                        </span>
                        {row.image_url ? <span aria-label="Has screenshot" title="Has screenshot">📷</span> : null}
                      </span>
                      <span style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexShrink: 0 }}>
                        <span
                          style={{
                            fontSize: "0.7rem",
                            fontWeight: 700,
                            padding: "0.15rem 0.5rem",
                            borderRadius: "999px",
                            color: "white",
                            background: STATUS_COLOR[row.status] ?? "#6b7280",
                          }}
                        >
                          {STATUS_LABEL[row.status] ?? row.status}
                        </span>
                        <span style={{ fontSize: "0.75rem", opacity: 0.6 }}>{formatDate(row.created_at)}</span>
                      </span>
                    </button>

                    {isExpanded ? (
                      <div style={{ padding: "0 0.8rem 0.8rem", fontSize: "0.8125rem" }}>
                        <p style={{ margin: "0 0 0.5rem", whiteSpace: "pre-wrap" }}>{row.description}</p>

                        {row.image_url ? (
                          <a href={row.image_url} target="_blank" rel="noreferrer">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={row.image_url}
                              alt="Attached screenshot"
                              style={{
                                maxWidth: "220px",
                                maxHeight: "160px",
                                borderRadius: "4px",
                                border: "1px solid var(--theme-elevation-150)",
                                marginBottom: "0.6rem",
                                display: "block",
                              }}
                            />
                          </a>
                        ) : null}

                        <p style={{ margin: "0 0 0.25rem", opacity: 0.75 }}>
                          {row.name ?? "—"} · {row.email ?? "—"}
                        </p>
                        <p style={{ margin: "0 0 0.6rem", opacity: 0.75 }}>
                          From:{" "}
                          <a href={row.page_url} target="_blank" rel="noreferrer">
                            {row.page_url}
                          </a>
                        </p>

                        {row.status_timeline?.length ? (
                          <details style={{ marginBottom: "0.6rem" }}>
                            <summary style={{ cursor: "pointer", opacity: 0.75 }}>
                              History ({row.status_timeline.length})
                            </summary>
                            <ul style={{ margin: "0.4rem 0 0", paddingLeft: "1.1rem" }}>
                              {row.status_timeline.map((entry, i) => (
                                <li key={i} style={{ opacity: 0.75, marginBottom: "0.2rem" }}>
                                  {STATUS_LABEL[entry.status] ?? entry.status} — {formatDate(entry.changedAt)}
                                  {entry.note ? `: ${entry.note}` : ""}
                                </li>
                              ))}
                            </ul>
                          </details>
                        ) : null}

                        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
                          <select
                            value={statusDraft}
                            onChange={(e) =>
                              setStatusDrafts((prev) => ({ ...prev, [row.id]: e.target.value }))
                            }
                            style={{
                              padding: "0.3rem 0.5rem",
                              borderRadius: "4px",
                              border: "1px solid var(--theme-elevation-150)",
                              background: "var(--theme-input-bg, transparent)",
                              color: "inherit",
                            }}
                          >
                            {STATUS_OPTIONS.map((s) => (
                              <option key={s} value={s}>
                                {STATUS_LABEL[s]}
                              </option>
                            ))}
                          </select>
                          <input
                            type="text"
                            placeholder="Note (optional)"
                            value={noteDrafts[row.id] ?? ""}
                            onChange={(e) =>
                              setNoteDrafts((prev) => ({ ...prev, [row.id]: e.target.value }))
                            }
                            style={{
                              flex: "1 1 200px",
                              padding: "0.3rem 0.5rem",
                              borderRadius: "4px",
                              border: "1px solid var(--theme-elevation-150)",
                              background: "var(--theme-input-bg, transparent)",
                              color: "inherit",
                            }}
                          />
                          <Button
                            buttonStyle="secondary"
                            size="small"
                            disabled={savingId === row.id}
                            onClick={() => void saveStatus(row.id)}
                          >
                            {savingId === row.id ? "Saving…" : "Update"}
                          </Button>
                          {savedId === row.id ? (
                            <span style={{ fontSize: "0.75rem", color: "#00875a" }}>Saved</span>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
