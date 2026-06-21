"use client";

import { MatchCentreTabs } from "@/components/match-centre/MatchCentreTabs";
import { MatchCentreMatchPicker } from "@/components/match-centre/MatchCentreMatchPicker";
import type { MatchWeather } from "@/lib/cricket/providers/weather";
import type { MatchHighlight } from "@/lib/cricket/services/match-highlight";
import type { LiveMatchFeed, Scorecard } from "@/lib/cricket/types";

type Props = {
  highlight: MatchHighlight | null;
  liveMatches?: MatchHighlight[];
  selectedMatchId?: string | null;
  onSelectMatch?: (matchId: string) => void;
  scorecard?: Scorecard | null;
  liveFeed?: LiveMatchFeed | null;
  weather?: MatchWeather | null;
};

function VenueWeather({ weather }: { weather: MatchWeather }) {
  const parts = [
    `${weather.tempC}°C`,
    weather.label,
    weather.windKmh != null ? `💨 ${weather.windKmh} km/h` : null,
    weather.humidityPct != null ? `💧 ${weather.humidityPct}%` : null,
  ].filter(Boolean);

  return (
    <div className="rounded-lg border-2 border-emerald/25 bg-white/70 px-3 py-2">
      <p className="flex flex-wrap items-center gap-x-2 text-xs font-bold uppercase text-charcoal/80">
        <span aria-hidden>{weather.emoji}</span>
        <span>{weather.city}</span>
        <span className="text-charcoal/40">·</span>
        <span>{parts.join(" · ")}</span>
      </p>

      {weather.hourly.length > 0 ? (
        <div className="mt-2 grid grid-cols-3 gap-1 border-t border-emerald/15 pt-2 sm:grid-cols-6">
          {weather.hourly.map((hour) => (
            <div
              key={hour.time}
              className="flex flex-col items-center rounded bg-emerald/5 px-1 py-1.5 text-center"
              title={`${hour.time} — ${hour.label}${
                hour.precipitationMm ? ` · ${hour.precipitationMm} mm` : ""
              }`}
            >
              <span className="font-mono text-[10px] font-bold text-charcoal/55">
                {hour.time}
              </span>
              <span className="text-sm leading-tight" aria-hidden>
                {hour.emoji}
              </span>
              <span className="text-[11px] font-bold text-charcoal/80">{hour.tempC}°</span>
              {hour.precipitationMm ? (
                <span className="text-[10px] font-bold text-emerald">
                  {hour.precipitationMm} mm
                </span>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function MatchCentre({
  highlight,
  liveMatches = [],
  selectedMatchId = null,
  onSelectMatch,
  scorecard,
  liveFeed,
  weather,
}: Props) {
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

  return (
    <section id="match-centre" className="fan-card">
      <div className="fan-card-header-split flex items-center justify-between gap-3 px-4 py-3 md:px-5">
        <h2
          className={`font-display text-sm font-extrabold uppercase tracking-wider md:text-lg ${
            isLive ? "match-centre-live-title -mx-1 px-2 py-1" : ""
          }`}
        >
          {isLive ? "Live Now — Match Centre" : "Last Result — Match Centre"}
        </h2>
        {isLive ? (
          <span className="animate-live-pulse flex shrink-0 items-center gap-2 rounded-full border-2 border-white bg-emerald px-3 py-1.5 text-xs font-extrabold uppercase text-white shadow-md">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-white" aria-hidden />
            LIVE
          </span>
        ) : (
          <span className="shrink-0 rounded-full border-2 border-white bg-emerald px-3 py-1.5 text-xs font-extrabold uppercase text-white shadow-md">
            Full Time
          </span>
        )}
      </div>

      {highlight.mode === "live" && liveMatches.length > 1 && onSelectMatch ? (
        <MatchCentreMatchPicker
          matches={liveMatches}
          selectedMatchId={selectedMatchId ?? highlight.matchId}
          onSelect={onSelectMatch}
        />
      ) : null}

      <div className="space-y-4 bg-gradient-to-b from-emerald/5 to-crimson/5 p-4 md:p-5">
        {highlight.bannerTitle ? (
          <p className="rounded-lg border-2 border-amber/50 bg-amber/15 px-4 py-3 text-center text-sm font-extrabold uppercase tracking-wide text-charcoal">
            {highlight.bannerTitle}
            {highlight.leagueLabel ? (
              <span className="mt-1 block text-[11px] font-semibold normal-case text-charcoal/65">
                {highlight.leagueLabel}
              </span>
            ) : null}
          </p>
        ) : null}

        <p className="rounded-lg border-l-4 border-crimson bg-crimson/10 px-3 py-2 text-sm font-bold text-charcoal">
          {highlight.title}
        </p>

        <div className="rounded-xl border-2 border-emerald bg-gradient-to-r from-emerald/20 via-white to-crimson/20 p-4">
          <p className="font-display text-2xl font-extrabold uppercase tracking-tight text-emerald md:text-3xl">
            {highlight.scoreLine}
          </p>
          <p className="mt-2 text-sm font-bold uppercase text-charcoal">{highlight.detailLine}</p>
        </div>

        {weather ? <VenueWeather weather={weather} /> : null}

        <MatchCentreTabs isLive={isLive} liveFeed={liveFeed ?? null} scorecard={scorecard ?? null} />
      </div>
    </section>
  );
}
