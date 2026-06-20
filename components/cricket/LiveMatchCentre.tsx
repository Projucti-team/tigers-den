"use client";

import { useCallback, useEffect, useState } from "react";

import { MatchCentre } from "@/components/home/MatchCentre";
import { MatchCentreMatchPicker } from "@/components/match-centre/MatchCentreMatchPicker";
import type { MatchWeather } from "@/lib/cricket/providers/weather";
import type { MatchHighlight } from "@/lib/cricket/services/match-highlight";
import type { LiveMatchFeed, Scorecard } from "@/lib/cricket/types";

type LiveMatchCentreProps = {
  initialHighlight: MatchHighlight | null;
  initialLiveMatches?: MatchHighlight[];
  initialScorecard: Scorecard | null;
  initialLiveFeed?: LiveMatchFeed | null;
  initialWeather?: MatchWeather | null;
  initialMatchId?: string | null;
};

const POLL_MS = 30_000;

export function LiveMatchCentre({
  initialHighlight,
  initialLiveMatches = [],
  initialScorecard,
  initialLiveFeed = null,
  initialWeather = null,
  initialMatchId = null,
}: LiveMatchCentreProps) {
  const [selectedMatchId, setSelectedMatchId] = useState(
    initialMatchId ?? initialHighlight?.matchId ?? null,
  );
  const [highlight, setHighlight] = useState(initialHighlight);
  const [liveMatches, setLiveMatches] = useState(initialLiveMatches);
  const [scorecard, setScorecard] = useState(initialScorecard);
  const [liveFeed, setLiveFeed] = useState(initialLiveFeed);
  const [weather, setWeather] = useState(initialWeather);

  const refresh = useCallback(async (matchId?: string | null) => {
    try {
      const query = matchId ? `?matchId=${encodeURIComponent(matchId)}` : "";
      const res = await fetch(`/api/cricket/match-centre${query}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as {
        highlight: MatchHighlight | null;
        liveMatches?: MatchHighlight[];
        scorecard: Scorecard | null;
        liveFeed: LiveMatchFeed | null;
        weather?: MatchWeather | null;
      };

      const nextLive = data.liveMatches ?? [];
      setLiveMatches(nextLive);
      setHighlight(data.highlight);
      setScorecard(data.scorecard);
      setLiveFeed(data.liveFeed);
      setWeather(data.weather ?? null);

      if (matchId && data.highlight?.matchId !== matchId && nextLive.length) {
        setSelectedMatchId(nextLive[0].matchId);
      } else if (data.highlight?.matchId) {
        setSelectedMatchId(data.highlight.matchId);
      }
    } catch {
      // keep last snapshot
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      if (cancelled) return;
      await refresh(selectedMatchId);
    }

    void poll();
    const timer = window.setInterval(() => void poll(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [refresh, selectedMatchId]);

  function handleSelect(matchId: string) {
    setSelectedMatchId(matchId);
    void refresh(matchId);
  }

  const pickerMatches =
    liveMatches.length > 0
      ? liveMatches
      : highlight?.mode === "live" && highlight
        ? [highlight]
        : [];

  return (
    <MatchCentre
      highlight={highlight}
      liveMatches={pickerMatches}
      selectedMatchId={selectedMatchId}
      onSelectMatch={handleSelect}
      scorecard={scorecard}
      liveFeed={liveFeed}
      weather={weather}
    />
  );
}
