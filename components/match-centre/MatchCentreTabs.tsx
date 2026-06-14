"use client";

import { useEffect, useState } from "react";

import { MatchCentreLiveTab } from "@/components/match-centre/MatchCentreLiveTab";
import { MatchCentreScorecardTab } from "@/components/match-centre/MatchCentreScorecardTab";
import type { LiveMatchFeed, Scorecard } from "@/lib/cricket/types";

type Tab = "live" | "scorecard";

type Props = {
  isLive: boolean;
  liveFeed: LiveMatchFeed | null;
  scorecard: Scorecard | null;
};

export function MatchCentreTabs({ isLive, liveFeed, scorecard }: Props) {
  const [tab, setTab] = useState<Tab>(isLive ? "live" : "scorecard");

  useEffect(() => {
    if (isLive) setTab("live");
  }, [isLive]);

  const tabs: { id: Tab; label: string }[] = isLive
    ? [
        { id: "live", label: "Live" },
        { id: "scorecard", label: "Scorecard" },
      ]
    : [{ id: "scorecard", label: "Scorecard" }];

  return (
    <div>
      <div className="flex gap-1 border-b-2 border-charcoal/10">
        {tabs.map((t) => {
          const active = tab === t.id;
          const liveTab = t.id === "live" && isLive;

          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`relative flex items-center gap-1.5 px-4 py-2.5 font-display text-xs font-extrabold uppercase tracking-wider transition-colors md:text-sm ${
                liveTab
                  ? `match-centre-live-tab text-crimson ${active ? "bg-crimson/5" : "hover:bg-crimson/5"}`
                  : active
                    ? "text-emerald after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-emerald"
                    : "text-charcoal/50 hover:text-charcoal"
              }`}
            >
              {liveTab ? (
                <span
                  className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-crimson shadow-[0_0_6px_rgba(244,42,65,0.8)]"
                  aria-hidden
                />
              ) : null}
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="pt-5">
        {tab === "live" ? (
          <MatchCentreLiveTab feed={liveFeed} scorecard={scorecard} />
        ) : (
          <MatchCentreScorecardTab scorecard={scorecard} />
        )}
      </div>
    </div>
  );
}
