"use client";

import { Button } from "@payloadcms/ui";
import { useEffect, useState } from "react";

type PlayerSummary = {
  id: number;
  displayName: string;
  countryName: string;
  profileUrl: string | null;
  hasPhoto: boolean;
  cricinfoPlayerId: number | null;
  iccPlayerId: number | null;
};

type Group = { countryName: string; players: PlayerSummary[] };

/** How complete a record looks — used to pre-select the best "keep" candidate per group. */
function completeness(p: PlayerSummary): number {
  return (p.profileUrl ? 1 : 0) + (p.hasPhoto ? 1 : 0) + (p.cricinfoPlayerId ? 1 : 0) + (p.iccPlayerId ? 1 : 0);
}

export default function PlayerMergePanel() {
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [keepByGroup, setKeepByGroup] = useState<Record<number, number>>({});
  const [mergingGroup, setMergingGroup] = useState<number | null>(null);
  const [doneGroups, setDoneGroups] = useState<Set<number>>(new Set());

  async function load() {
    setError(null);
    try {
      const res = await fetch("/api/admin/players-merge", {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      const body = (await res.json().catch(() => ({}))) as { groups?: Group[]; error?: string };
      if (!res.ok) throw new Error(body.error ?? `Failed to load (HTTP ${res.status})`);
      setGroups(body.groups ?? []);

      const defaults: Record<number, number> = {};
      (body.groups ?? []).forEach((group, i) => {
        const best = [...group.players].sort((a, b) => completeness(b) - completeness(a))[0];
        defaults[i] = best.id;
      });
      setKeepByGroup(defaults);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load duplicate players");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function merge(groupIndex: number, group: Group) {
    const keepId = keepByGroup[groupIndex];
    const mergeIds = group.players.map((p) => p.id).filter((id) => id !== keepId);
    if (!keepId || mergeIds.length === 0) return;

    setMergingGroup(groupIndex);
    setError(null);
    try {
      const res = await fetch("/api/admin/players-merge", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ keepId, mergeIds }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? `Merge failed (HTTP ${res.status})`);
      setDoneGroups((prev) => new Set(prev).add(groupIndex));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Merge failed");
    } finally {
      setMergingGroup(null);
    }
  }

  if (!groups) return null;

  const pending = groups.filter((_, i) => !doneGroups.has(i));

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
      <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>Possible duplicate players</h3>
      <p style={{ margin: "0.5rem 0 1rem", fontSize: "0.875rem", opacity: 0.85 }}>
        Same person, different spelling across sources (e.g. &ldquo;Mohammad&rdquo; vs
        &ldquo;Mohammed&rdquo;) creates two separate records. Pick which one to keep — the others&rsquo;
        names are saved as aliases on it (so future syncs resolve to the same record) and the
        duplicates are deleted.
      </p>

      {error ? (
        <p style={{ margin: "0 0 0.75rem", fontSize: "0.8125rem", color: "#c41e24" }}>{error}</p>
      ) : null}

      {pending.length === 0 ? (
        <p style={{ fontSize: "0.8125rem", opacity: 0.8 }}>No likely duplicates found right now.</p>
      ) : (
        pending.map((group) => {
          const groupIndex = groups.indexOf(group);
          const keepId = keepByGroup[groupIndex];
          return (
            <div
              key={groupIndex}
              style={{
                padding: "0.75rem",
                marginBottom: "0.75rem",
                borderRadius: "6px",
                border: "1px solid var(--theme-elevation-150)",
              }}
            >
              <div style={{ fontSize: "0.75rem", opacity: 0.65, marginBottom: "0.4rem" }}>
                {group.countryName}
              </div>
              {group.players.map((p) => (
                <label
                  key={p.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    padding: "0.25rem 0",
                    fontSize: "0.8125rem",
                  }}
                >
                  <input
                    type="radio"
                    name={`keep-${groupIndex}`}
                    checked={keepId === p.id}
                    onChange={() => setKeepByGroup((prev) => ({ ...prev, [groupIndex]: p.id }))}
                  />
                  <span style={{ fontWeight: keepId === p.id ? 600 : 400 }}>{p.displayName}</span>
                  <span style={{ opacity: 0.6 }}>
                    {[
                      p.profileUrl ? "profile linked" : null,
                      p.hasPhoto ? "has photo" : null,
                      p.cricinfoPlayerId ? `cricinfo #${p.cricinfoPlayerId}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "no data resolved yet"}
                  </span>
                </label>
              ))}
              <div style={{ marginTop: "0.5rem" }}>
                <Button
                  buttonStyle="secondary"
                  size="small"
                  disabled={mergingGroup === groupIndex}
                  onClick={() => void merge(groupIndex, group)}
                >
                  {mergingGroup === groupIndex
                    ? "Merging…"
                    : `Merge into "${group.players.find((p) => p.id === keepId)?.displayName}"`}
                </Button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
