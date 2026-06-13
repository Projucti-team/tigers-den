import { PlayerRankAvatar } from "@/components/home/PlayerRankAvatar";
import { isBangladeshTeam } from "@/lib/cricket/constants";
import type { FormatShowcase } from "@/lib/cricket/services/rankings-display";
import type { WtcShowcase } from "@/lib/cricket/services/wtc";
import type { RankedPlayer, RankedTeam, WtcTeamStanding } from "@/lib/cricket/types";

export const PLAYER_ACCENT_STYLES = {
  green: {
    border: "border-emerald/40",
    accent: "border-l-emerald",
    badge: "bg-emerald text-white",
    rank: "text-emerald",
  },
  red: {
    border: "border-crimson/40",
    accent: "border-l-crimson",
    badge: "bg-crimson text-white",
    rank: "text-crimson",
  },
  amber: {
    border: "border-amber/50",
    accent: "border-l-amber",
    badge: "bg-charcoal text-amber",
    rank: "text-charcoal",
  },
} as const;

export type PlayerAccent = keyof typeof PLAYER_ACCENT_STYLES;
export type PlayerRole = "Batter" | "Bowler" | "All-Rounder";

export function formatRank(rank: number, tied?: boolean): string {
  return tied ? `=${rank}` : String(rank);
}

/** ICC rank_date ("2026-06-08") → "8 Jun 2026". */
export function formatRankDate(date: string | null | undefined): string | null {
  if (!date) return null;
  const parsed = new Date(date.includes("T") ? date : `${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** ICC rank_date subtitle, e.g. "Rankings updated 9 Jun 2026". */
export function rankDateSubtitle(date: string | null | undefined): string | undefined {
  const formatted = formatRankDate(date);
  return formatted ? `Rankings updated ${formatted}` : undefined;
}

/** Most recent ICC rank_date across all tables in format showcases. */
export function latestRankUpdatedAt(formats: FormatShowcase[]): string | null {
  const dates = formats.flatMap((f) => [
    f.rankUpdatedAt.team,
    f.rankUpdatedAt.bat,
    f.rankUpdatedAt.bowl,
    f.rankUpdatedAt.allrounder,
  ]);
  return dates.filter((d): d is string => Boolean(d)).sort().pop() ?? null;
}

export function playerPhotoSrc(player: RankedPlayer): string | null {
  const url = player.imageUrl ?? "";
  if (!url || url.includes("ui-avatars.com")) return null;
  if (url.includes("/icon512.") || url.includes("default-player-logo")) return null;
  if (player.iccPlayerId && url.includes("a.espncdn.com")) return null;
  return url;
}

export function BangladeshRankCard({ format }: { format: FormatShowcase }) {
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

export function WtcBangladeshCard({ wtc }: { wtc: WtcShowcase }) {
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

export function TigerPlayerCard({
  player,
  role,
  accent,
  compact = false,
}: {
  player: RankedPlayer | null;
  role: PlayerRole;
  accent: PlayerAccent;
  compact?: boolean;
}) {
  if (!player) {
    return (
      <div className="flex min-h-[7rem] items-center justify-center rounded-xl border-2 border-dashed border-charcoal/20 bg-charcoal/5 px-4 text-center text-xs text-charcoal/40">
        No ranked Tiger {role.toLowerCase()}
      </div>
    );
  }

  const { border, accent: accentBorder, badge, rank: rankColor } = PLAYER_ACCENT_STYLES[accent];
  const fallbackSrc = `https://ui-avatars.com/api/?name=${encodeURIComponent(player.name)}&background=006a4e&color=fff&size=256&bold=true`;
  const photo = playerPhotoSrc(player) ?? fallbackSrc;
  const profileUrl = player.profileUrl;

  const card = (
    <article
      className={`group relative flex overflow-hidden rounded-xl border ${border} border-l-4 ${accentBorder} bg-white shadow-sm transition-shadow hover:shadow-md ${
        compact ? "min-h-[5.5rem]" : "min-h-[7rem]"
      }`}
    >
      <div
        className={`flex min-w-0 flex-1 flex-col justify-center gap-1 py-3 pl-4 ${
          compact ? "pr-[5.5rem] md:pr-28" : "pr-[7.5rem] md:pr-36"
        }`}
      >
        <span
          className={`w-fit rounded px-2 py-0.5 font-display font-extrabold uppercase tracking-wide ${badge} ${
            compact ? "text-[9px]" : "text-[10px]"
          }`}
        >
          {role}
        </span>
        <p
          className={`font-display font-extrabold leading-none ${rankColor} ${
            compact ? "text-2xl md:text-3xl" : "text-4xl md:text-5xl"
          }`}
        >
          #{formatRank(player.rank, player.rankTied)}
        </p>
        <p
          className={`font-display font-bold leading-snug text-charcoal ${
            compact ? "text-xs md:text-sm" : "text-sm md:text-base"
          }`}
        >
          {player.name}
        </p>
        {!compact ? (
          <p className="font-mono text-[10px] font-bold text-charcoal/45">Rating {player.rating}</p>
        ) : null}
      </div>

      <div
        className={`pointer-events-none absolute inset-y-0 right-0 bg-gradient-to-l from-charcoal/5 to-transparent ${
          compact ? "w-[5.5rem] md:w-28" : "w-[7.5rem] md:w-36"
        }`}
        aria-hidden
      />
      <div
        className={`absolute inset-y-0 right-0 overflow-hidden ${
          compact ? "w-[5.5rem] md:w-28" : "w-[7.5rem] md:w-36"
        }`}
      >
        <PlayerRankAvatar
          src={photo}
          fallbackSrc={fallbackSrc}
          alt={player.name}
          className="h-full w-full object-cover object-top"
        />
      </div>
    </article>
  );

  if (profileUrl) {
    return (
      <a
        href={profileUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald"
        title={`View ${player.name} on ICC`}
      >
        {card}
      </a>
    );
  }

  return card;
}

export function TeamStandingsTable({
  teams,
  formatLabel,
  variant = "emerald",
}: {
  teams: RankedTeam[];
  formatLabel: string;
  variant?: "emerald" | "crimson";
}) {
  const head = variant === "crimson" ? "text-crimson border-crimson/20 bg-crimson/5" : "text-emerald border-emerald/20 bg-emerald/5";
  const rating = variant === "crimson" ? "text-crimson" : "text-emerald";
  const border = variant === "crimson" ? "border-crimson/30" : "border-emerald/30";

  if (!teams.length) {
    return (
      <p className="rounded-xl border-2 border-dashed border-charcoal/20 bg-white/90 px-4 py-8 text-center text-sm text-charcoal/50">
        {formatLabel} team rankings unavailable
      </p>
    );
  }

  return (
    <div className={`overflow-hidden rounded-xl border-2 ${border} bg-white shadow-sm`}>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className={`border-b-2 ${head}`}>
            <th className="px-4 py-3 font-display text-xs font-extrabold uppercase tracking-wide">#</th>
            <th className="px-4 py-3 font-display text-xs font-extrabold uppercase tracking-wide">Team</th>
            <th className="hidden px-4 py-3 text-right font-display text-xs font-extrabold uppercase tracking-wide sm:table-cell">
              Matches
            </th>
            <th className="px-4 py-3 text-right font-display text-xs font-extrabold uppercase tracking-wide">
              Rating
            </th>
          </tr>
        </thead>
        <tbody>
          {teams.map((team) => {
            const isBd = isBangladeshTeam(team.name) || isBangladeshTeam(team.abbreviation);
            return (
              <tr
                key={`${team.rank}-${team.name}`}
                className={`border-b border-charcoal/5 last:border-0 ${
                  isBd ? "bg-emerald/10 font-semibold" : ""
                }`}
              >
                <td className="px-4 py-2.5 font-mono font-bold text-charcoal">{team.rank}</td>
                <td className="px-4 py-2.5 text-charcoal">
                  {team.name}
                  {isBd ? (
                    <span className="ml-2 rounded bg-emerald px-1.5 py-0.5 text-[10px] font-extrabold uppercase text-white">
                      Tigers
                    </span>
                  ) : null}
                </td>
                <td className="hidden px-4 py-2.5 text-right font-mono text-charcoal/70 sm:table-cell">
                  {team.matches ?? "—"}
                </td>
                <td className={`px-4 py-2.5 text-right font-mono font-bold ${rating}`}>
                  {team.rating}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function WtcStandingsTable({
  standings,
  cycleLabel,
}: {
  standings: WtcTeamStanding[];
  cycleLabel: string;
}) {
  if (!standings.length) {
    return (
      <p className="rounded-xl border-2 border-dashed border-charcoal/20 bg-white/90 px-4 py-8 text-center text-sm text-charcoal/50">
        WTC standings unavailable
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border-2 border-crimson/30 bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b-2 border-crimson/20 bg-crimson/5">
            <th className="px-4 py-3 font-display text-xs font-extrabold uppercase tracking-wide text-crimson">
              #
            </th>
            <th className="px-4 py-3 font-display text-xs font-extrabold uppercase tracking-wide text-crimson">
              Team
            </th>
            <th className="hidden px-4 py-3 text-right font-display text-xs font-extrabold uppercase tracking-wide text-crimson md:table-cell">
              Record
            </th>
            <th className="px-4 py-3 text-right font-display text-xs font-extrabold uppercase tracking-wide text-crimson">
              PCT
            </th>
            <th className="hidden px-4 py-3 text-right font-display text-xs font-extrabold uppercase tracking-wide text-crimson sm:table-cell">
              Pts
            </th>
          </tr>
        </thead>
        <tbody>
          {standings.map((team) => {
            const isBd = isBangladeshTeam(team.team) || isBangladeshTeam(team.abbreviation);
            return (
              <tr
                key={`${team.rank}-${team.team}`}
                className={`border-b border-charcoal/5 last:border-0 ${
                  isBd ? "bg-crimson/10 font-semibold" : ""
                }`}
              >
                <td className="px-4 py-2.5 font-mono font-bold text-charcoal">{team.rank}</td>
                <td className="px-4 py-2.5 text-charcoal">
                  {team.team}
                  {isBd ? (
                    <span className="ml-2 rounded bg-crimson px-1.5 py-0.5 text-[10px] font-extrabold uppercase text-white">
                      Tigers
                    </span>
                  ) : null}
                </td>
                <td className="hidden px-4 py-2.5 text-right font-mono text-xs text-charcoal/70 md:table-cell">
                  {team.won}W · {team.lost}L{team.drawn > 0 ? ` · ${team.drawn}D` : ""} · {team.played}P
                </td>
                <td className="px-4 py-2.5 text-right font-mono font-bold text-crimson">{team.pct}%</td>
                <td className="hidden px-4 py-2.5 text-right font-mono text-charcoal/70 sm:table-cell">
                  {team.points}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="border-t border-crimson/10 bg-charcoal/5 px-4 py-2 text-center text-[10px] font-bold uppercase tracking-wide text-charcoal/45">
        World Test Championship · {cycleLabel}
      </p>
    </div>
  );
}

export function TigersPlayerList({
  players,
  role,
  accent,
}: {
  players: RankedPlayer[];
  role: PlayerRole;
  accent: PlayerAccent;
}) {
  if (!players.length) {
    return (
      <div className="flex min-h-[5rem] items-center justify-center rounded-xl border-2 border-dashed border-charcoal/20 bg-charcoal/5 px-4 text-center text-xs text-charcoal/40">
        No Tigers in the top 100
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {players.map((player) => (
        <TigerPlayerCard
          key={`${player.rank}-${player.name}`}
          player={player}
          role={role}
          accent={accent}
          compact
        />
      ))}
    </div>
  );
}
