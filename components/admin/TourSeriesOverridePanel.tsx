"use client";

import { Button } from "@payloadcms/ui";
import { Fragment, useEffect, useState } from "react";

type TourSeriesRow = {
  tour_id: string;
  tour_slug: string;
  current_status: string;
  espn_cricinfo_series_id: number | null;
  espn_league_id: number | null;
  espn_series_override: number | null;
  squad_story_url: string | null;
  manual_squad_text: string | null;
  updated_at: string;
};

function espnSeriesUrl(id: number): string {
  return `https://www.espncricinfo.com/series/_/id/${id}`;
}

export default function TourSeriesOverridePanel() {
  const [rows, setRows] = useState<TourSeriesRow[] | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [manualDrafts, setManualDrafts] = useState<Record<string, string>>({});
  const [savingManualId, setSavingManualId] = useState<string | null>(null);
  const [savedManualId, setSavedManualId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const res = await fetch("/api/admin/tour-series", {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      const body = (await res.json().catch(() => ({}))) as { rows?: TourSeriesRow[]; error?: string };
      if (!res.ok) throw new Error(body.error ?? `Failed to load (HTTP ${res.status})`);
      setRows(body.rows ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tour series state");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function save(tourId: string, raw: string) {
    setSavingId(tourId);
    setError(null);
    const trimmed = raw.trim();
    const cricinfoSeriesId = trimmed === "" ? null : Number(trimmed);

    try {
      const res = await fetch("/api/admin/tour-series", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ tour_id: tourId, cricinfoSeriesId }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? `Save failed (HTTP ${res.status})`);
      await load();
      setSavedId(tourId);
      setTimeout(() => setSavedId((current) => (current === tourId ? null : current)), 6000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSavingId(null);
    }
  }

  async function saveManualSquadText(tourId: string, raw: string) {
    setSavingManualId(tourId);
    setError(null);

    try {
      const res = await fetch("/api/admin/tour-series", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ tour_id: tourId, manualSquadText: raw }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? `Save failed (HTTP ${res.status})`);
      await load();
      setSavedManualId(tourId);
      setTimeout(() => setSavedManualId((current) => (current === tourId ? null : current)), 6000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSavingManualId(null);
    }
  }

  if (!rows) {
    return null;
  }

  const active = rows.filter((r) => r.current_status === "active");

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
      <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>ESPN series source per tour</h3>
      <p style={{ margin: "0.5rem 0 1rem", fontSize: "0.875rem", opacity: 0.85 }}>
        Shows which ESPNcricinfo series each active tour is pulling fixtures/squads from. If a tour
        is matched to the wrong series, paste the correct cricinfo series id (the number at the end
        of the espncricinfo.com/series/... URL) and save — the next sync will use it instead of
        auto-discovery.
      </p>

      {error ? (
        <p style={{ margin: "0 0 0.75rem", fontSize: "0.8125rem", color: "#c41e24" }}>{error}</p>
      ) : null}

      {active.length === 0 ? (
        <p style={{ fontSize: "0.8125rem", opacity: 0.8 }}>No active tours tracked yet.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid var(--theme-elevation-150)" }}>
              <th style={{ padding: "0.4rem 0.5rem 0.4rem 0" }}>Tour</th>
              <th style={{ padding: "0.4rem 0.5rem" }}>Resolved series</th>
              <th style={{ padding: "0.4rem 0.5rem" }}>Override</th>
              <th style={{ padding: "0.4rem 0.5rem" }} />
            </tr>
          </thead>
          <tbody>
            {active.map((row) => {
              const draft = drafts[row.tour_id] ?? String(row.espn_series_override ?? "");
              const manualDraft = manualDrafts[row.tour_id] ?? row.manual_squad_text ?? "";
              return (
                <Fragment key={row.tour_id}>
                  <tr style={{ borderBottom: "1px solid var(--theme-elevation-100)" }}>
                    <td style={{ padding: "0.5rem 0.5rem 0.5rem 0" }}>{row.tour_slug}</td>
                    <td style={{ padding: "0.5rem" }}>
                      {row.espn_cricinfo_series_id ? (
                        <a href={espnSeriesUrl(row.espn_cricinfo_series_id)} target="_blank" rel="noreferrer">
                          {row.espn_cricinfo_series_id}
                        </a>
                      ) : (
                        <span style={{ opacity: 0.6 }}>not resolved yet</span>
                      )}
                      {row.espn_league_id ? (
                        <div style={{ fontSize: "0.7rem", opacity: 0.6, marginTop: "0.15rem" }}>
                          league id: {row.espn_league_id}
                          {row.espn_league_id === row.espn_cricinfo_series_id ? " (unresolved — placeholder, ESPN calls likely returning nothing)" : ""}
                        </div>
                      ) : null}
                    </td>
                    <td style={{ padding: "0.5rem" }}>
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="cricinfo series id"
                        value={draft}
                        onChange={(e) =>
                          setDrafts((prev) => ({ ...prev, [row.tour_id]: e.target.value }))
                        }
                        style={{
                          width: "9rem",
                          padding: "0.3rem 0.5rem",
                          borderRadius: "4px",
                          border: "1px solid var(--theme-elevation-150)",
                          background: "var(--theme-input-bg, transparent)",
                        }}
                      />
                    </td>
                    <td style={{ padding: "0.5rem" }}>
                      <Button
                        buttonStyle="secondary"
                        size="small"
                        disabled={savingId === row.tour_id}
                        onClick={() => void save(row.tour_id, draft)}
                      >
                        {savingId === row.tour_id ? "Saving…" : "Save"}
                      </Button>
                      {savedId === row.tour_id ? (
                        <div style={{ marginTop: "0.35rem", fontSize: "0.75rem", color: "#00b368" }}>
                          Saved. Run cricket sync (above) to apply — this doesn&rsquo;t re-resolve until
                          the next sync.
                        </div>
                      ) : null}
                    </td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid var(--theme-elevation-150)" }}>
                    <td colSpan={4} style={{ padding: "0 0.5rem 0.75rem 0" }}>
                      <div style={{ fontSize: "0.75rem", opacity: 0.7, marginBottom: "0.3rem" }}>
                        Squad not showing? CricAPI and ESPN&rsquo;s API don&rsquo;t have it yet, and
                        ESPN blocks us from fetching their news pages directly — so paste the squad
                        here instead. One team per line: <code>Team name: Player 1 (c), Player 2
                        (wk), Player 3, ...</code> — <code>(c)</code> marks the captain,{" "}
                        <code>(wk)</code> the wicketkeeper (combine as <code>(c/wk)</code> if one
                        player is both). This always wins over anything auto-fetched.
                      </div>
                      <textarea
                        rows={3}
                        placeholder={
                          "Australia Test squad: Pat Cummins (c), Scott Boland, Alex Carey (wk), Cameron Green, Josh Hazlewood, Travis Head, Josh Inglis (wk), Marnus Labuschagne, Nathan Lyon, Steven Smith, Mitchell Starc, Jake Weatherald, Beau Webster\nBangladesh Test squad: Najmul Hossain Shanto (c), Mushfiqur Rahim (wk), Shadman Islam, ..."
                        }
                        value={manualDraft}
                        onChange={(e) =>
                          setManualDrafts((prev) => ({ ...prev, [row.tour_id]: e.target.value }))
                        }
                        style={{
                          width: "100%",
                          maxWidth: "48rem",
                          padding: "0.4rem 0.5rem",
                          borderRadius: "4px",
                          border: "1px solid var(--theme-elevation-150)",
                          background: "var(--theme-input-bg, transparent)",
                          fontFamily: "inherit",
                          fontSize: "0.8125rem",
                          display: "block",
                        }}
                      />
                      <div style={{ marginTop: "0.35rem" }}>
                        <Button
                          buttonStyle="secondary"
                          size="small"
                          disabled={savingManualId === row.tour_id}
                          onClick={() => void saveManualSquadText(row.tour_id, manualDraft)}
                        >
                          {savingManualId === row.tour_id ? "Saving…" : "Save squad"}
                        </Button>
                        {savedManualId === row.tour_id ? (
                          <span style={{ marginLeft: "0.6rem", fontSize: "0.75rem", color: "#00b368" }}>
                            Saved. Run cricket sync to apply.
                          </span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
