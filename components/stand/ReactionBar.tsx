"use client";

import { useSession } from "next-auth/react";
import { useCallback, useState } from "react";

import {
  REACTION_OPTIONS,
  type ReactionId,
  type ReactionSummary,
  type ReactionTargetType,
} from "@/lib/stand/engagement-types";
import { JOIN_PAGE_PATH } from "@/lib/site-content";

type ReactionBarProps = {
  targetType: ReactionTargetType;
  targetId: number;
  initial?: ReactionSummary;
  compact?: boolean;
};

const EMPTY: ReactionSummary = {
  totals: { roar: 0, love: 0, fire: 0, clap: 0, hundred: 0 },
  totalCount: 0,
  userReaction: null,
};

export function ReactionBar({
  targetType,
  targetId,
  initial,
  compact = false,
}: ReactionBarProps) {
  const { status } = useSession();
  const [summary, setSummary] = useState<ReactionSummary>(initial ?? EMPTY);
  const [busy, setBusy] = useState<ReactionId | null>(null);

  const react = useCallback(
    async (reaction: ReactionId) => {
      if (status !== "authenticated") {
        window.location.href = JOIN_PAGE_PATH;
        return;
      }

      setBusy(reaction);
      try {
        const res = await fetch("/api/stand/reactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetType, targetId, reaction }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as { reactions: ReactionSummary };
        setSummary(data.reactions);
      } finally {
        setBusy(null);
      }
    },
    [status, targetType, targetId],
  );

  return (
    <div
      className={`flex flex-wrap items-center gap-1 ${compact ? "" : "gap-1.5"}`}
      role="group"
      aria-label="Reactions"
    >
      {REACTION_OPTIONS.map((option) => {
        const count = summary.totals[option.id];
        const active = summary.userReaction === option.id;
        return (
          <button
            key={option.id}
            type="button"
            title={option.label}
            disabled={busy === option.id}
            onClick={() => void react(option.id)}
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-semibold transition ${
              active
                ? "border-emerald-glow/60 bg-emerald/20 text-emerald-glow"
                : "border-white/10 bg-white/5 text-white/70 hover:border-white/25 hover:bg-white/10"
            } ${compact ? "px-1.5 py-0.5 text-[11px]" : ""}`}
          >
            <span aria-hidden>{option.emoji}</span>
            {count > 0 ? <span className="font-mono tabular-nums">{count}</span> : null}
            <span className="sr-only">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
