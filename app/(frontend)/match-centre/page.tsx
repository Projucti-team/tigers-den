import Link from "next/link";

import { ChantOfWeek } from "@/components/home/ChantOfWeek";
import { LiveChat } from "@/components/home/LiveChat";
import { LiveMatchCentre } from "@/components/cricket/LiveMatchCentre";
import { getMatchCentreData } from "@/lib/cricket";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Match Centre — The Tigers' Den",
  description: "Live scores, fan chat, and ball-by-ball for Bangladesh cricket.",
};

export default async function MatchCentrePage() {
  const { highlight, scorecard, liveFeed } = await getMatchCentreData().catch(() => ({
    highlight: null,
    scorecard: null,
    liveFeed: null,
  }));

  const isLive = highlight?.mode === "live";

  return (
    <div className="bg-surface">
      <div className="border-b-4 border-crimson bg-emerald py-4 text-center text-white">
        <p className="font-display text-xs font-bold uppercase tracking-widest text-amber">
          {isLive ? "Live Match Day" : "Match Centre"}
        </p>
        <h1 className="font-display text-2xl font-extrabold uppercase md:text-3xl">
          {isLive ? "Live Now" : "Last Result"}
        </h1>
        <Link href="/" className="mt-2 inline-block text-xs font-bold uppercase underline hover:text-amber">
          ← Back to home
        </Link>
      </div>

      <div className="mx-auto max-w-[1440px] space-y-6 px-4 py-8 md:px-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <LiveMatchCentre
            initialHighlight={highlight}
            initialScorecard={scorecard}
            initialLiveFeed={liveFeed}
          />
          <LiveChat
            matchId={highlight?.matchId ?? null}
            matchTitle={highlight?.title}
            initialIsLive={isLive}
          />
        </div>
        <div className="max-w-md">
          <ChantOfWeek />
        </div>
      </div>
    </div>
  );
}
