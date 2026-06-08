import Link from "next/link";

import {
  formatBangladeshDate,
  formatMatchScheduleLine,
  formatMatchStatus,
} from "@/lib/cricket/datetime-bd";
import type { SquadPlayer } from "@/lib/cricket/curated-squads";
import { sortMatchesByDate } from "@/lib/cricket/match-sort";
import type { TourDetail } from "@/lib/cricket/tour-detail-types";
import { formatDateRange } from "@/lib/cricket/services/tours-display";
import type { LiveMatchSummary } from "@/lib/cricket/types";

function formatMatchType(match: LiveMatchSummary): string {
  const t = match.matchType?.toUpperCase() ?? "";
  if (t === "TEST") return "Test";
  if (t === "ODI") return "ODI";
  if (t === "T20") return "T20I";
  return t || "International";
}

function SquadPlayerLink({ player }: { player: SquadPlayer }) {
  if (player.profileUrl) {
    return (
      <a
        href={player.profileUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="font-semibold text-emerald hover:text-crimson hover:underline"
      >
        {player.name}
      </a>
    );
  }
  return <span>{player.name}</span>;
}

export function TourDetailView({ detail }: { detail: TourDetail }) {
  const { tour, card, squads, venues, warnings } = detail;
  const matches = sortMatchesByDate(detail.matches);

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-10 md:px-8">
      <Link href="/tours" className="text-xs font-bold uppercase text-emerald hover:text-crimson">
        ← All tours
      </Link>

      <header className="mt-4 rounded-lg border-4 border-emerald bg-white p-6 shadow-lg md:p-8">
        <p className="fan-section-label text-crimson">Upcoming series</p>
        <h1 className="font-display mt-2 text-2xl font-extrabold uppercase text-charcoal md:text-4xl">
          {card.title}
        </h1>
        <p className="mt-2 text-sm font-semibold text-emerald">{formatDateRange(tour)}</p>
        <p className="mt-1 text-sm text-charcoal/65">{card.description}</p>
      </header>

      {warnings.length > 0 ? (
        <ul className="mt-4 space-y-1 rounded-lg border border-amber/40 bg-amber/15 px-4 py-3 text-xs font-medium text-amber">
          {warnings.map((w) => (
            <li key={w}>• {w}</li>
          ))}
        </ul>
      ) : null}

      <section className="mt-10">
        <h2 className="fan-section-label text-amber">Squads</h2>
        {squads.length === 0 ? (
          <p className="mt-3 text-sm text-white/60">
            Squads will appear here when announced by the boards — check back before the series
            starts.
          </p>
        ) : (
          <div className="mt-4 grid gap-6 md:grid-cols-2">
            {squads.map((squad) => (
              <div
                key={squad.team}
                className="rounded-lg border-2 border-emerald/30 bg-white p-5 shadow-sm"
              >
                <h3 className="font-display text-sm font-extrabold uppercase text-emerald">
                  {squad.team}
                </h3>
                {squad.source ? (
                  <a
                    href={squad.source}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-block text-[10px] font-semibold uppercase text-charcoal/45 hover:text-emerald"
                  >
                    Source: ESPNcricinfo →
                  </a>
                ) : null}
                <ul className="mt-3 columns-1 gap-x-6 text-sm text-charcoal/80 sm:columns-2">
                  {squad.players.map((player) => (
                    <li key={`${squad.team}-${player.name}`} className="mb-1 break-inside-avoid">
                      <SquadPlayerLink player={player} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="fan-section-label text-amber">Fixtures</h2>
        {matches.length === 0 ? (
          <p className="mt-3 text-sm text-white/60">
            Fixtures are not listed yet. Follow the series on our Match Centre for live updates.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {matches.map((match) => (
              <li
                key={match.id}
                className="rounded-lg border-2 border-emerald/25 bg-white p-4 shadow-sm md:flex md:items-center md:justify-between md:gap-4"
              >
                <div>
                  <p className="font-display text-sm font-extrabold uppercase text-charcoal">
                    {match.name}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-emerald">
                    {formatMatchScheduleLine(match) || formatBangladeshDate(match.date)} ·{" "}
                    {formatMatchType(match)}
                  </p>
                  {match.venue ? (
                    <p className="mt-1 text-xs text-charcoal/60">{match.venue}</p>
                  ) : null}
                </div>
                <p className="mt-2 rounded border border-charcoal/10 bg-charcoal/5 px-3 py-2 text-[10px] font-bold uppercase text-charcoal/60 md:mt-0 md:max-w-xs md:text-right">
                  {formatMatchStatus(match)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="fan-section-label text-amber">Venues & host cities</h2>
        {venues.length === 0 ? (
          <p className="mt-3 text-sm text-white/60">
            Venue guides will appear when fixtures are confirmed.
          </p>
        ) : (
          <div className="mt-4 grid gap-6 lg:grid-cols-2">
            {venues.map((v) => (
              <article
                key={v.venueName}
                className="rounded-lg border-2 border-crimson/20 bg-white p-5 shadow-sm"
              >
                <h3 className="font-display text-base font-extrabold uppercase text-emerald">
                  {v.venueName}
                </h3>
                <p className="mt-1 text-xs font-bold uppercase tracking-wide text-crimson">
                  {v.city}
                </p>
                <p className="mt-3 text-sm leading-relaxed text-charcoal/75">{v.about}</p>
                <p className="mt-3 text-sm leading-relaxed text-charcoal/75">
                  <span className="font-semibold text-charcoal">The city: </span>
                  {v.cityAbout}
                </p>
                <p className="mt-3 rounded bg-emerald/5 px-3 py-2 text-xs leading-relaxed text-charcoal/70">
                  <span className="font-semibold text-emerald">Weather: </span>
                  {v.weather}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
