import Link from "next/link";

import type { MatchHighlight } from "@/lib/cricket/services/match-highlight";

type Props = {
  highlight: MatchHighlight | null;
};

export function LiveMatchStrip({ highlight }: Props) {
  if (!highlight) return null;

  const isLive = highlight.mode === "live";

  return (
    <section
      className={`border-y-4 py-6 ${
        isLive
          ? "border-amber bg-gradient-to-r from-emerald via-emerald-bright/90 to-emerald"
          : "border-emerald/40 bg-emerald/15"
      }`}
    >
      <div className="mx-auto flex max-w-[1440px] flex-col items-center justify-between gap-4 px-4 md:flex-row md:px-8">
        <div className="text-center md:text-left">
          <p
            className={`font-display text-xs font-extrabold uppercase tracking-widest ${
              isLive ? "text-amber" : "text-emerald-glow"
            }`}
          >
            {isLive ? "Live Now" : "Last Result"}
          </p>
          <p className="mt-1 font-display text-lg font-extrabold uppercase text-white md:text-xl">
            {highlight.title}
          </p>
          <p className="mt-1 font-mono text-2xl font-bold text-white">{highlight.scoreLine}</p>
          <p className="mt-1 text-sm text-white/80">
            {highlight.detailLine}
          </p>
        </div>

        {isLive ? (
          <span className="flex items-center gap-2 rounded-full border-2 border-white bg-crimson px-4 py-2 font-display text-xs font-extrabold uppercase text-white">
            <span className="h-2 w-2 animate-pulse rounded-full bg-white" aria-hidden />
            Live
          </span>
        ) : (
          <span className="rounded-full border-2 border-white/40 bg-white/10 px-4 py-2 font-display text-xs font-extrabold uppercase text-white">
            Full Time
          </span>
        )}

        <Link
          href={`/match-centre${highlight.matchId ? `?match=${highlight.matchId}` : ""}`}
          className="rounded border-2 border-white bg-white px-6 py-3 font-display text-xs font-extrabold uppercase text-emerald transition-colors hover:bg-amber hover:text-pitch"
        >
          Match Centre →
        </Link>
      </div>
    </section>
  );
}
