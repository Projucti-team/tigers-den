import Link from "next/link";

import { LiveMatchCentre } from "@/components/cricket/LiveMatchCentre";
import { ChantOfWeek } from "@/components/home/ChantOfWeek";
import { LiveChat } from "@/components/home/LiveChat";
import { getMatchCentreData } from "@/lib/cricket";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Match Centre — The Tigers' Den",
  description: "Live scores, fan chat, and ball-by-ball for Bangladesh cricket.",
};

type PageProps = {
  searchParams: Promise<{ match?: string; matchId?: string }>;
};

export default async function MatchCentrePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const selectedMatchId = params.matchId ?? params.match ?? undefined;
  const { highlight, liveMatches, scorecard, liveFeed, weather } = await getMatchCentreData(
    selectedMatchId,
  ).catch(() => ({
    highlight: null,
    liveMatches: [],
    scorecard: null,
    liveFeed: null,
    weather: null,
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
            initialLiveMatches={liveMatches}
            initialScorecard={scorecard}
            initialLiveFeed={liveFeed}
            initialWeather={weather}
            initialMatchId={selectedMatchId ?? highlight?.matchId ?? null}
          />
          <LiveChat />
        </div>
        <div className="max-w-md">
          <ChantOfWeek />
        </div>
      </div>
    </div>
  );
}
