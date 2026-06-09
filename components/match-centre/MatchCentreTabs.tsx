"use client";

import { useState } from "react";

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

  const tabs: { id: Tab; label: string }[] = isLive
    ? [
        { id: "live", label: "Live" },
        { id: "scorecard", label: "Scorecard" },
      ]
    : [{ id: "scorecard", label: "Scorecard" }];

  return (
    <div>
      <div className="flex gap-1 border-b-2 border-charcoal/10">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`relative px-4 py-2.5 font-display text-xs font-extrabold uppercase tracking-wider transition-colors md:text-sm ${
              tab === t.id
                ? "text-emerald after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-emerald"
                : "text-charcoal/50 hover:text-charcoal"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="pt-5">
        {tab === "live" ? (
          <MatchCentreLiveTab feed={liveFeed} />
        ) : (
          <MatchCentreScorecardTab scorecard={scorecard} />
        )}
      </div>
    </div>
  );
}
