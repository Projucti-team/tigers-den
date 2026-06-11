import {
  BangladeshRankCard,
  TigerPlayerCard,
  WtcBangladeshCard,
  formatRankDate,
  latestRankUpdatedAt,
} from "@/components/rankings/RankingsUi";
import type { FormatShowcase, RankingsShowcase } from "@/lib/cricket/services/rankings-display";
import type { WtcShowcase } from "@/lib/cricket/services/wtc";

type Props = {
  men: RankingsShowcase;
  women: RankingsShowcase;
  wtc?: WtcShowcase | null;
  warnings?: string[];
};

function FormatColumn({ format }: { format: FormatShowcase }) {
  return (
    <div className="space-y-3">
      <h3 className="text-center font-display text-lg font-extrabold uppercase tracking-wide fan-gradient-text">
        {format.label}
      </h3>
      <div className="flex flex-col gap-3">
        <TigerPlayerCard player={format.topBatsman} role="Batter" accent="green" />
        <TigerPlayerCard player={format.topBowler} role="Bowler" accent="red" />
        <TigerPlayerCard player={format.topAllRounder} role="All-Rounder" accent="amber" />
      </div>
    </div>
  );
}

function GenderBlock({
  showcase,
  title,
  wtc,
}: {
  showcase: RankingsShowcase;
  title: string;
  wtc?: WtcShowcase | null;
}) {
  return (
    <div className="space-y-8">
      <div className="text-center">
        <h3 className="font-display text-xl font-extrabold uppercase text-white md:text-2xl">
          {title}
        </h3>
        <p className="mt-1 text-sm text-white/65">
          Bangladesh team position &amp; highest-ranked Tigers by format
        </p>
      </div>

      <div
        className={`grid gap-4 ${
          wtc && showcase.formats.length === 3
            ? "sm:grid-cols-2 lg:grid-cols-4"
            : showcase.formats.length === 2
              ? "md:grid-cols-2"
              : "md:grid-cols-3"
        }`}
      >
        {showcase.formats.map((f) => (
          <BangladeshRankCard key={f.format} format={f} />
        ))}
        {wtc ? <WtcBangladeshCard wtc={wtc} /> : null}
      </div>

      <div className="fan-vibrant-card rounded-2xl border-4 border-amber/50 p-5 md:p-8">
        <p className="mb-6 text-center font-display text-sm font-extrabold uppercase tracking-widest fan-gradient-text">
          Top Ranked Tigers by Format
        </p>
        <div
          className={`grid gap-6 ${showcase.formats.length === 2 ? "md:grid-cols-2" : "md:grid-cols-3"}`}
        >
          {showcase.formats.map((f) => (
            <FormatColumn key={f.format} format={f} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function IccRankingsShowcase({ men, women, wtc = null, warnings = [] }: Props) {
  const updated = formatRankDate(latestRankUpdatedAt([...men.formats, ...women.formats]));

  return (
    <section
      id="rankings"
      className="scroll-mt-24 border-y-4 border-amber/80 py-14 md:scroll-mt-28 md:py-20"
    >
      <div className="mx-auto max-w-[1440px] px-4 md:px-8">
        <div className="text-center">
          <p className="fan-section-label text-amber">ICC Rankings</p>
          <h2 className="mt-4 font-display text-3xl font-extrabold uppercase text-white md:text-4xl">
            Bangladesh <span className="text-emerald-glow">on the world stage</span>
          </h2>
          {updated ? (
            <p className="mt-2 font-mono text-xs font-bold uppercase tracking-widest text-white/55">
              ICC rankings updated {updated}
            </p>
          ) : null}
        </div>

        <div className="mt-12 space-y-16">
          <GenderBlock showcase={men} title="Men's Team" wtc={wtc} />
          <GenderBlock showcase={women} title="Women's Team" />
        </div>

        {warnings.length > 0 ? (
          <div className="mt-8 rounded-lg border-2 border-amber/40 bg-amber/15 px-4 py-3 text-center text-xs font-semibold text-amber">
            {warnings[0]}
            {warnings.length > 1 ? ` (+${warnings.length - 1} more — check /api/cricket)` : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
