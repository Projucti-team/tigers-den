"use client";

import { useEffect, useState } from "react";

import { FanMarquee } from "@/components/layout/FanMarquee";

type LiveMarqueeProps = {
  initialItems: string[];
};

const POLL_MS = 45_000;

export function LiveMarquee({ initialItems }: LiveMarqueeProps) {
  const [items, setItems] = useState(initialItems);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      try {
        const res = await fetch("/api/cricket/marquee", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { items?: string[] };
        if (data.items?.length && !cancelled) {
          setItems(data.items);
        }
      } catch {
        // keep last good ticker
      }
    }

    void refresh();
    const timer = window.setInterval(() => void refresh(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  return <FanMarquee items={items} />;
}
