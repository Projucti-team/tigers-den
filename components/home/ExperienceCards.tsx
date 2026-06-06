import Link from "next/link";

import { CountryFlag } from "@/components/CountryFlag";
import type { TourCard } from "@/lib/cricket/services/tours-display";
import { BANGLADESH_FLAG_ISO } from "@/lib/cricket/tour-flags";
import { experiences } from "@/lib/site-content";

type Props = {
  featuredAwayTour: TourCard | null;
  hasLiveMatch?: boolean;
  hasRecentMatch?: boolean;
};

type Accent = "green" | "red";

const ACCENT_STYLES: Record<
  Accent,
  {
    border: string;
    hoverBorder: string;
    hoverShadow: string;
    glow: string;
    iconRing: string;
    iconBg: string;
    cta: string;
    ctaHover: string;
  }
> = {
  green: {
    border: "border-emerald/25",
    hoverBorder: "hover:border-emerald-glow/45",
    hoverShadow: "hover:shadow-[0_24px_48px_-16px_rgba(0,230,118,0.28)]",
    glow: "from-emerald-glow/25 via-emerald-bright/10 to-transparent",
    iconRing: "ring-emerald-glow/30",
    iconBg: "from-emerald/50 to-emerald/15",
    cta: "text-emerald-glow",
    ctaHover: "group-hover:text-emerald-bright",
  },
  red: {
    border: "border-crimson/25",
    hoverBorder: "hover:border-crimson-glow/45",
    hoverShadow: "hover:shadow-[0_24px_48px_-16px_rgba(255,23,68,0.28)]",
    glow: "from-crimson-glow/25 via-crimson-bright/10 to-transparent",
    iconRing: "ring-crimson-glow/30",
    iconBg: "from-crimson/50 to-crimson/15",
    cta: "text-crimson-glow",
    ctaHover: "group-hover:text-crimson-bright",
  },
};

export function ExperienceCards({
  featuredAwayTour,
  hasLiveMatch = false,
  hasRecentMatch = false,
}: Props) {
  const tourCard = featuredAwayTour
    ? {
        id: "next-away-tour",
        title: featuredAwayTour.title,
        subtitle: `${featuredAwayTour.dateRange} · ${featuredAwayTour.description}. Travel with The Tigers' Den.`,
        cta: "View Series",
        href: "/tours",
        accent: "green" as const,
        flagIso: featuredAwayTour.headerFlagIso,
      }
    : {
        id: "tours",
        title: "Upcoming Tours",
        subtitle:
          "Check the latest Bangladesh FTP series — dates, formats, and tour packages with The Tigers' Den.",
        cta: "View Tours",
        href: "/tours",
        accent: "green" as const,
        flagIso: BANGLADESH_FLAG_ISO,
      };

  const matchCard = {
    ...experiences[2],
    accent: "red" as const,
    cta: hasLiveMatch ? "Go Live" : "Match Centre",
    subtitle: hasLiveMatch
      ? "Bangladesh are live right now — scores, ball-by-ball, and The Roar chat."
      : hasRecentMatch
        ? "Catch the last Bangladesh result — scores, summary, and full scorecard."
        : experiences[2].subtitle,
  };

  const ticketsCard = {
    ...experiences[1],
    accent: "green" as const,
  };

  const cards = [tourCard, matchCard, ticketsCard];

  return (
    <section className="border-y-4 border-amber/80 py-14 md:py-20">
      <div className="mx-auto max-w-[1440px] px-4 md:px-8">
        <h2 className="text-center font-display text-2xl font-extrabold uppercase md:text-3xl">
          <span className="text-emerald-glow">Choose your next </span>
          <span className="text-crimson-glow">Tigers&apos; Den experience</span>
        </h2>

        <div className="mt-10 grid gap-5 md:grid-cols-3 md:gap-6">
          {cards.map((exp) => {
            const styles = ACCENT_STYLES[exp.accent];
            const isLive = exp.id === "match" && hasLiveMatch;

            return (
              <Link
                key={exp.id}
                href={exp.href}
                className={`group relative flex min-h-[320px] flex-col overflow-hidden rounded-2xl border bg-white/[0.04] backdrop-blur-md transition-all duration-300 hover:-translate-y-1 ${styles.border} ${styles.hoverBorder} ${styles.hoverShadow}`}
              >
                <div
                  className={`pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b ${styles.glow}`}
                  aria-hidden
                />
                <div
                  className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.06] via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  aria-hidden
                />

                <div className="relative flex flex-1 flex-col p-6 md:p-7">
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ring-1 ${styles.iconBg} ${styles.iconRing} shadow-md transition-transform duration-300 group-hover:scale-105`}
                  >
                    {"flagIso" in exp ? (
                      <CountryFlag iso={exp.flagIso} size="sm" className="ring-1 ring-white/40" />
                    ) : (
                      <span className="text-2xl drop-shadow-sm" aria-hidden>
                        {"emoji" in exp ? exp.emoji : "🏏"}
                      </span>
                    )}
                  </div>

                  <div className="mt-6 flex flex-1 flex-col">
                    <div className="flex items-center gap-2">
                      <h3 className="font-display text-lg font-extrabold uppercase tracking-wide text-white">
                        {exp.title}
                      </h3>
                      {isLive ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-crimson-glow/40 bg-crimson/20 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-crimson-glow">
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-crimson-glow" />
                          Live
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-3 flex-1 text-sm leading-relaxed text-white/60">
                      {exp.subtitle}
                    </p>
                    <span
                      className={`mt-6 inline-flex items-center gap-2 font-display text-xs font-extrabold uppercase tracking-widest transition-all duration-300 group-hover:gap-3 ${styles.cta} ${styles.ctaHover}`}
                    >
                      {exp.cta}
                      <span
                        className="inline-block transition-transform duration-300 group-hover:translate-x-0.5"
                        aria-hidden
                      >
                        →
                      </span>
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
