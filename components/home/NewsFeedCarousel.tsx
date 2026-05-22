"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { CricketNewsItem } from "@/lib/news/types";

const SOURCE_LABELS = {
  espncricinfo: "ESPN Cricinfo",
  cricbuzz: "Cricbuzz",
} as const;

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {direction === "left" ? (
        <path d="M15 18l-6-6 6-6" />
      ) : (
        <path d="M9 18l6-6-6-6" />
      )}
    </svg>
  );
}

type Props = {
  items: CricketNewsItem[];
};

export function NewsFeedCarousel({ items }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 4);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 4);
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;

    updateScrollState();
    el.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);

    return () => {
      el.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, [items.length, updateScrollState]);

  const scroll = (direction: "left" | "right") => {
    const el = trackRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>("[data-news-card]");
    const step = card ? card.offsetWidth + 20 : el.clientWidth * 0.85;
    el.scrollBy({
      left: direction === "left" ? -step : step,
      behavior: "smooth",
    });
  };

  return (
    <div className="relative mt-10">
      <button
        type="button"
        onClick={() => scroll("left")}
        disabled={!canScrollLeft}
        aria-label="Previous news"
        className="absolute left-0 top-1/2 z-10 hidden -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-emerald bg-white p-2.5 text-emerald shadow-md transition hover:bg-emerald hover:text-white disabled:pointer-events-none disabled:opacity-30 md:flex"
      >
        <ChevronIcon direction="left" />
      </button>

      <button
        type="button"
        onClick={() => scroll("right")}
        disabled={!canScrollRight}
        aria-label="Next news"
        className="absolute right-0 top-1/2 z-10 hidden translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-crimson bg-white p-2.5 text-crimson shadow-md transition hover:bg-crimson hover:text-white disabled:pointer-events-none disabled:opacity-30 md:flex"
      >
        <ChevronIcon direction="right" />
      </button>

      <div
        ref={trackRef}
        className="flex gap-5 overflow-x-auto scroll-smooth pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ scrollSnapType: "x mandatory" }}
      >
        {items.map((item) => (
          <article
            key={item.id}
            data-news-card
            className="flex w-[min(100%,280px)] shrink-0 flex-col overflow-hidden rounded-lg border-2 border-emerald/25 bg-white shadow-sm transition hover:border-emerald/50 sm:w-[300px] md:w-[320px]"
            style={{ scrollSnapAlign: "start" }}
          >
            {item.imageUrl ? (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block aspect-[16/9] overflow-hidden bg-charcoal/5"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.imageUrl}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </a>
            ) : (
              <div
                className="flex aspect-[16/9] items-center justify-center bg-gradient-to-br from-emerald to-crimson text-4xl"
                aria-hidden
              >
                🐯
              </div>
            )}
            <div className="flex flex-1 flex-col p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="rounded bg-emerald/10 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide text-emerald">
                  {SOURCE_LABELS[item.source]}
                </span>
                <time
                  dateTime={item.publishedAt}
                  className="font-mono text-[10px] text-charcoal/45"
                >
                  {formatRelativeTime(item.publishedAt)}
                </time>
              </div>
              <h3 className="mt-2 flex-1 font-display text-sm font-extrabold uppercase leading-snug text-charcoal">
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-emerald"
                >
                  {item.title}
                </a>
              </h3>
              {item.summary && (
                <p className="mt-2 line-clamp-2 text-sm text-charcoal/70">{item.summary}</p>
              )}
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 text-xs font-extrabold uppercase text-crimson hover:underline"
              >
                Read on {SOURCE_LABELS[item.source]} →
              </a>
            </div>
          </article>
        ))}
      </div>

      <div className="mt-4 flex justify-center gap-3 md:hidden">
        <button
          type="button"
          onClick={() => scroll("left")}
          disabled={!canScrollLeft}
          aria-label="Previous news"
          className="rounded-full border-2 border-emerald bg-white px-4 py-2 text-xs font-extrabold uppercase text-emerald disabled:opacity-30"
        >
          ← Prev
        </button>
        <button
          type="button"
          onClick={() => scroll("right")}
          disabled={!canScrollRight}
          aria-label="Next news"
          className="rounded-full border-2 border-crimson bg-white px-4 py-2 text-xs font-extrabold uppercase text-crimson disabled:opacity-30"
        >
          Next →
        </button>
      </div>
    </div>
  );
}
