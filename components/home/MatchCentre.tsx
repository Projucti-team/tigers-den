import Link from "next/link";

import type { MatchHighlight } from "@/lib/cricket/services/match-highlight";
import type { Scorecard } from "@/lib/cricket/types";

type Props = {
  highlight: MatchHighlight | null;
  scorecard?: Scorecard | null;
};

export function MatchCentre({ highlight, scorecard }: Props) {
  if (!highlight) {
    return (
      <section id="match-centre" className="fan-card">
        <div className="fan-card-header-split px-4 py-3 md:px-5">
          <h2 className="font-display text-sm font-extrabold uppercase tracking-wider md:text-lg">
            Match Centre
          </h2>
        </div>
        <div className="p-6 text-center text-sm text-charcoal/60">
          No live or recent Bangladesh matches available. Check back on match day.
        </div>
      </section>
    );
  }

  const isLive = highlight.mode === "live";
  const innings = scorecard?.innings ?? [];

  return (
    <section id="match-centre" className="fan-card">
      <div className="fan-card-header-split flex items-center justify-between px-4 py-3 md:px-5">
        <h2 className="font-display text-sm font-extrabold uppercase tracking-wider md:text-lg">
          {isLive ? "🔴 Live Now — Match Centre" : "📋 Last Result — Match Centre"}
        </h2>
        {isLive ? (
          <span className="animate-live-pulse flex items-center gap-2 rounded-full border-2 border-white bg-crimson px-3 py-1.5 text-xs font-extrabold uppercase">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-white" aria-hidden />
            LIVE
          </span>
        ) : (
          <span className="rounded-full border-2 border-charcoal/20 bg-charcoal/10 px-3 py-1.5 text-xs font-extrabold uppercase text-charcoal">
            Full Time
          </span>
        )}
      </div>

      <div className="space-y-4 bg-gradient-to-b from-emerald/5 to-crimson/5 p-4 md:p-5">
        <p className="rounded-lg border-l-4 border-crimson bg-crimson/10 px-3 py-2 text-sm font-bold text-charcoal">
          {highlight.title}
        </p>

        <div className="rounded-xl border-2 border-emerald bg-gradient-to-r from-emerald/20 via-white to-crimson/20 p-4">
          <p className="font-display text-2xl font-extrabold uppercase tracking-tight text-emerald md:text-3xl">
            {highlight.scoreLine}
          </p>
          <p className="mt-2 text-sm font-bold uppercase text-charcoal">{highlight.detailLine}</p>
        </div>

        {highlight.scores.length > 0 && (
          <div className="grid gap-2 font-mono text-sm font-bold uppercase md:grid-cols-2">
            {highlight.scores.map((s) => (
              <p
                key={s.label}
                className="rounded-lg border-2 border-emerald/30 bg-white px-3 py-2 text-charcoal"
              >
                {s.label}: {s.value}
              </p>
            ))}
          </div>
        )}

        {innings.length > 0 && (
          <div className="grid gap-2 font-mono text-sm font-bold uppercase md:grid-cols-2">
            {innings.map((inn) => (
              <p
                key={inn.inning}
                className="rounded-lg bg-charcoal/5 px-3 py-2 text-charcoal/80"
              >
                {inn.inning}: {inn.runs}/{inn.wickets} ({inn.overs} ov)
              </p>
            ))}
          </div>
        )}

        {isLive ? (
          <p className="text-center text-xs font-semibold text-charcoal/50">
            Ball-by-ball, fan polls, and live chat coming soon.
          </p>
        ) : (
          <p className="text-center text-xs font-semibold text-charcoal/50">
            Final result from the most recent Bangladesh international.
          </p>
        )}

        {scorecard && (
          <p className="rounded-lg border border-emerald/30 bg-white px-3 py-2 text-xs text-charcoal/70">
            {scorecard.venue && <span className="block font-bold">{scorecard.venue}</span>}
            Match ID: {highlight.matchId}
          </p>
        )}
      </div>
    </section>
  );
}
