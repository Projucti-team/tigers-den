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

export function ExperienceCards({
  featuredAwayTour,
  hasLiveMatch = false,
  hasRecentMatch = false,
}: Props) {
  const staticCards = experiences.slice(1);

  const tourCard = featuredAwayTour
    ? {
        id: "next-away-tour",
        title: featuredAwayTour.title,
        subtitle: `${featuredAwayTour.dateRange} · ${featuredAwayTour.description}. Travel with The Tigers' Den.`,
        cta: "View Series",
        href: "#tours",
        accent: "green" as const,
        flagIso: featuredAwayTour.headerFlagIso,
      }
    : {
        id: "tours",
        title: "Upcoming Tours",
        subtitle:
          "Check the latest Bangladesh FTP series — dates, formats, and tour packages with The Tigers' Den.",
        cta: "View Tours",
        href: "#tours",
        accent: "green" as const,
        flagIso: BANGLADESH_FLAG_ISO,
      };

  const matchCard = {
    ...experiences[2],
    cta: hasLiveMatch ? "Go Live" : "Match Centre",
    subtitle: hasLiveMatch
      ? "Bangladesh are live right now — scores, ball-by-ball, and The Roar chat."
      : hasRecentMatch
        ? "Catch the last Bangladesh result — scores, summary, and full scorecard."
        : experiences[2].subtitle,
  };

  const cards = [tourCard, experiences[1], matchCard];

  return (
    <section className="fan-section-vibrant border-y-4 border-emerald/30 py-14 md:py-20">
      <div className="mx-auto max-w-[1440px] px-4 md:px-8">
        <h2 className="text-center font-display text-2xl font-extrabold uppercase md:text-3xl">
          <span className="fan-gradient-text">Choose your next Tigers&apos; Den experience</span>
        </h2>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {cards.map((exp) => (
            <article
              key={exp.id}
              className={`fan-vibrant-card group flex flex-col overflow-hidden border-4 transition-transform hover:-translate-y-2 ${
                exp.accent === "green"
                  ? "border-emerald hover:shadow-[0_16px_48px_rgba(0,106,78,0.25)]"
                  : "border-crimson hover:shadow-[0_16px_48px_rgba(244,42,65,0.25)]"
              }`}
            >
              <div
                className={`flex h-36 items-center justify-center ${
                  exp.accent === "green"
                    ? "fan-card-header-green"
                    : "fan-card-header-red"
                }`}
              >
                {"flagIso" in exp ? (
                  <CountryFlag iso={exp.flagIso} size="lg" />
                ) : (
                  <span className="text-6xl" aria-hidden>
                    {"emoji" in exp ? exp.emoji : "🏏"}
                  </span>
                )}
              </div>
              <div className="flex flex-1 flex-col p-6">
                <h3 className="font-display text-lg font-extrabold uppercase text-charcoal">
                  {exp.title}
                </h3>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-charcoal/80">
                  {exp.subtitle}
                </p>
                <Link
                  href={exp.href}
                  className={`mt-6 inline-block w-fit rounded px-5 py-2.5 text-xs ${
                    exp.accent === "green" ? "fan-btn-green" : "fan-btn-red"
                  } ${exp.id === "match" && hasLiveMatch ? "animate-live-pulse" : ""}`}
                >
                  {exp.cta}
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
