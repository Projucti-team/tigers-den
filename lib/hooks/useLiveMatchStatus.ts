"use client";

import { useEffect, useState } from "react";

const POLL_MS = 45_000;

/** Polls marquee API for Bangladesh live match status (shared with top ticker). */
export function useLiveMatchStatus(initialIsLive = false) {
  const [isLive, setIsLive] = useState(initialIsLive);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      try {
        const res = await fetch("/api/cricket/marquee", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { isLive?: boolean };
        if (!cancelled && typeof data.isLive === "boolean") {
          setIsLive(data.isLive);
        }
      } catch {
        // keep last good value
      }
    }

    void refresh();
    const timer = window.setInterval(() => void refresh(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  return isLive;
}
