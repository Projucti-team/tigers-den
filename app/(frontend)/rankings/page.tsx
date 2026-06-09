import Link from "next/link";

import { RankingsPageView } from "@/components/rankings/RankingsPageView";
import { PageHero } from "@/components/pages/PageHero";
import { getRankingsShowcase } from "@/lib/cricket";
import { emptyRankingsShowcase } from "@/lib/cricket/services/rankings-display";

export const metadata = {
  title: "ICC Rankings — The Tigers' Den",
  description:
    "ICC team top 10s, World Test Championship standings, and every Bangladesh player in the top 100 — Test, ODI, and T20I.",
};

export default async function RankingsPage() {
  const rankings = await getRankingsShowcase().catch(() => ({
    fetchedAt: new Date(0).toISOString(),
    men: emptyRankingsShowcase("men"),
    women: emptyRankingsShowcase("women"),
    wtc: null,
    warnings: [
      "ICC rankings unavailable. Run npm run sync:cricket or wait for the nightly refresh.",
    ],
  }));

  return (
    <>
      <PageHero
        label="ICC Rankings"
        title="World rankings"
        subtitle="WTC and format-by-format ICC team top 10s, plus every Bangladesh player in the top 100."
      />
      <div className="mx-auto max-w-[1440px] px-4 pb-2 pt-2 md:px-8">
        <Link href="/" className="text-xs font-bold uppercase text-amber hover:text-emerald-glow">
          ← Home
        </Link>
      </div>
      <RankingsPageView
        men={rankings.men}
        women={rankings.women}
        wtc={rankings.wtc}
        warnings={rankings.warnings}
      />
    </>
  );
}
