"use client";

import { useEffect, useState } from "react";

import { MatchCentre } from "@/components/home/MatchCentre";
import type { MatchHighlight } from "@/lib/cricket/services/match-highlight";
import type { LiveMatchFeed, Scorecard } from "@/lib/cricket/types";

type LiveMatchCentreProps = {
  initialHighlight: MatchHighlight | null;
  initialScorecard: Scorecard | null;
  initialLiveFeed?: LiveMatchFeed | null;
};

const POLL_MS = 30_000;

export function LiveMatchCentre({
  initialHighlight,
  initialScorecard,
  initialLiveFeed = null,
}: LiveMatchCentreProps) {
  const [highlight, setHighlight] = useState(initialHighlight);
  const [scorecard, setScorecard] = useState(initialScorecard);
  const [liveFeed, setLiveFeed] = useState(initialLiveFeed);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      try {
        const res = await fetch("/api/cricket/match-centre", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          highlight: MatchHighlight | null;
          scorecard: Scorecard | null;
          liveFeed: LiveMatchFeed | null;
        };
        if (!cancelled) {
          setHighlight(data.highlight);
          setScorecard(data.scorecard);
          setLiveFeed(data.liveFeed);
        }
      } catch {
        // keep last snapshot
      }
    }

    void refresh();
    const timer = window.setInterval(() => void refresh(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  return <MatchCentre highlight={highlight} scorecard={scorecard} liveFeed={liveFeed} />;
}
