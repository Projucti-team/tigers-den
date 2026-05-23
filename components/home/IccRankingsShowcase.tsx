import { PlayerRankAvatar } from "@/components/home/PlayerRankAvatar";
import type { FormatShowcase, RankingsShowcase } from "@/lib/cricket/services/rankings-display";
import type { WtcShowcase } from "@/lib/cricket/services/wtc";
import type { RankedPlayer } from "@/lib/cricket/types";

type Props = {
  men: RankingsShowcase;
  women: RankingsShowcase;
  wtc?: WtcShowcase | null;
  warnings?: string[];
};

function BangladeshRankCard({ format }: { format: FormatShowcase }) {
  const hasRank = format.bangladeshRank != null;

  return (
    <div className="flex flex-1 flex-col items-center rounded-xl border-4 border-emerald bg-white p-5 shadow-lg transition-transform hover:-translate-y-1">
      <p className="font-display text-sm font-extrabold uppercase tracking-widest text-crimson">
        {format.label}
      </p>
      {hasRank ? (
        <>
          <p className="mt-3 font-display text-6xl font-extrabold leading-none text-emerald md:text-7xl">
            #{format.bangladeshRank}
          </p>
          <p className="mt-2 font-mono text-xs font-bold uppercase text-charcoal/60">
            ICC Team Ranking
          </p>
          {format.bangladeshRating != null && (
            <p className="mt-3 rounded-full bg-emerald/10 px-4 py-1 font-mono text-sm font-bold text-emerald">
              Rating {format.bangladeshRating}
            </p>
          )}
        </>
      ) : (
        <p className="mt-6 text-center text-sm font-semibold text-charcoal/50">
          Ranking unavailable
        </p>
      )}
      <div className="mt-4 h-1 w-full rounded-full bg-gradient-to-r from-emerald to-crimson" />
    </div>
  );
}

function WtcBangladeshCard({ wtc }: { wtc: WtcShowcase }) {
  const bd = wtc.bangladesh;
  if (!bd) {
    return (
      <div className="flex flex-1 flex-col items-center rounded-xl border-4 border-crimson/40 bg-white p-5 shadow-lg">
        <p className="font-display text-sm font-extrabold uppercase tracking-widest text-crimson">
          WTC {wtc.cycleLabel}
        </p>
        <p className="mt-6 text-center text-sm font-semibold text-charcoal/50">
          Standings unavailable
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center rounded-xl border-4 border-crimson bg-white p-5 shadow-lg transition-transform hover:-translate-y-1">
      <p className="font-display text-sm font-extrabold uppercase tracking-widest text-crimson">
        WTC {wtc.cycleLabel}
      </p>
      <p className="mt-3 font-display text-6xl font-extrabold leading-none text-emerald md:text-7xl">
        #{bd.rank}
      </p>
      <p className="mt-2 font-mono text-xs font-bold uppercase text-charcoal/60">
        World Test Championship
      </p>
      <p className="mt-3 rounded-full bg-crimson/10 px-4 py-1 font-mono text-sm font-bold text-crimson">
        {bd.pct}% PCT
      </p>
      <p className="mt-2 font-mono text-xs font-bold text-charcoal/50">
        {bd.won}W · {bd.lost}L{bd.drawn > 0 ? ` · ${bd.drawn}D` : ""} · {bd.played} played
      </p>
      <div className="mt-4 h-1 w-full rounded-full bg-gradient-to-r from-crimson to-emerald" />
    </div>
  );
}

const ACCENT_STYLES = {
  green: { border: "border-emerald", badge: "bg-emerald text-white" },
  red: { border: "border-crimson", badge: "bg-crimson text-white" },
  amber: { border: "border-amber", badge: "bg-charcoal text-amber" },
} as const;

function playerPhotoSrc(player: RankedPlayer): string | null {
  const url = player.imageUrl ?? "";
  if (!url || url.includes("ui-avatars.com")) return null;
  if (url.includes("/icon512.") || url.includes("default-player-logo")) return null;
  if (player.iccPlayerId && url.includes("a.espncdn.com")) return null;
  return url;
}

function TigerPlayerCard({
  player,
  role,
  accent,
}: {
  player: FormatShowcase["topBatsman"];
  role: "Batter" | "Bowler" | "All-Rounder";
  accent: keyof typeof ACCENT_STYLES;
}) {
  if (!player) {
    return (
      <div className="flex min-h-[5.5rem] flex-1 items-center justify-center rounded-lg border-2 border-dashed border-charcoal/20 bg-charcoal/5 p-3 text-center text-xs text-charcoal/40">
        No ranked Tiger {role.toLowerCase()}
      </div>
    );
  }

  const { border, badge } = ACCENT_STYLES[accent];
  const fallbackSrc = `https://ui-avatars.com/api/?name=${encodeURIComponent(player.name)}&background=006a4e&color=fff&size=128`;
  const photo = playerPhotoSrc(player) ?? fallbackSrc;
  const profileUrl = player.profileUrl;

  const card = (
    <>
      <div className="relative h-14 w-14 overflow-hidden rounded-full border-2 border-charcoal/10 bg-charcoal/5">
        <PlayerRankAvatar
          src={photo}
          fallbackSrc={fallbackSrc}
          alt={player.name}
          className="h-full w-full object-cover object-top"
        />
      </div>
      <p className="mt-2 font-display text-2xl font-extrabold leading-none text-emerald">
        #{player.rank}
      </p>
      <span
        className={`mt-1 rounded px-2 py-0.5 font-display text-[10px] font-extrabold uppercase ${badge}`}
      >
        {role}
      </span>
      <p className="mt-2 w-full font-display text-sm font-bold leading-snug text-charcoal">
        {player.name}
      </p>
      <p className="mt-1 font-mono text-xs font-bold text-charcoal/50">
        Rating {player.rating}
      </p>
    </>
  );

  const className = `flex flex-col items-center rounded-xl border-2 ${border} bg-white p-3 text-center shadow-sm transition-colors`;

  if (profileUrl) {
    return (
      <a
        href={profileUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`${className} hover:border-emerald hover:bg-emerald/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald`}
        title={`View ${player.name} on ICC`}
      >
        {card}
      </a>
    );
  }

  return <article className={className}>{card}</article>;
}

function FormatColumn({ format }: { format: FormatShowcase }) {
  return (
    <div className="space-y-3">
      <h3 className="text-center font-display text-lg font-extrabold uppercase tracking-wide fan-gradient-text">
        {format.label}
      </h3>
      <div className="flex flex-col gap-2">
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
        <h3 className="font-display text-xl font-extrabold uppercase text-charcoal md:text-2xl">
          {title}
        </h3>
        <p className="mt-1 text-sm text-charcoal/60">
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
        {wtc && <WtcBangladeshCard wtc={wtc} />}
      </div>

      <div className="rounded-2xl border-4 border-amber/40 bg-gradient-to-br from-emerald/5 via-white to-crimson/5 p-5 md:p-8">
        <p className="mb-6 text-center font-display text-sm font-extrabold uppercase tracking-widest text-charcoal">
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
  return (
    <section
      id="rankings"
      className="border-y-4 border-emerald bg-gradient-to-b from-white via-surface to-white py-14 md:py-20"
    >
      <div className="mx-auto max-w-[1440px] px-4 md:px-8">
        <div className="text-center">
          <p className="font-display text-xs font-extrabold uppercase tracking-[0.3em] text-crimson">
            ICC Rankings
          </p>
          <h2 className="mt-2 font-display text-3xl font-extrabold uppercase text-charcoal md:text-4xl">
            Bangladesh <span className="text-emerald">on the world stage</span>
          </h2>
        </div>

        <div className="mt-12 space-y-16">
          <GenderBlock showcase={men} title="Men's Team" wtc={wtc} />
          <GenderBlock showcase={women} title="Women's Team" />
        </div>

        {warnings.length > 0 && (
          <div className="mt-8 rounded-lg border-2 border-amber/50 bg-amber/10 px-4 py-3 text-center text-xs font-semibold text-charcoal/70">
            {warnings[0]}
            {warnings.length > 1 && ` (+${warnings.length - 1} more — check /api/cricket)`}
          </div>
        )}
      </div>
    </section>
  );
}
