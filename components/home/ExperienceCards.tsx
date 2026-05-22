import Link from "next/link";

import type { TourCard } from "@/lib/cricket/services/tours-display";
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
        emoji: featuredAwayTour.emoji,
      }
    : {
        id: "tours",
        title: "Upcoming Tours",
        subtitle:
          "Check the latest Bangladesh FTP series — dates, formats, and tour packages with The Tigers' Den.",
        cta: "View Tours",
        href: "#tours",
        accent: "green" as const,
        emoji: "✈️",
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
    <section className="bg-white py-14 md:py-20">
      <div className="mx-auto max-w-[1440px] px-4 md:px-8">
        <h2 className="text-center font-display text-2xl font-extrabold uppercase text-charcoal md:text-3xl">
          Choose your next <span className="text-emerald">Tigers&apos; Den</span>{" "}
          <span className="text-crimson">experience</span>…
        </h2>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {cards.map((exp) => (
            <article
              key={exp.id}
              className={`group flex flex-col overflow-hidden rounded-lg border-4 shadow-lg transition-transform hover:-translate-y-1 ${
                exp.accent === "green"
                  ? "border-emerald hover:shadow-emerald/30"
                  : "border-crimson hover:shadow-crimson/30"
              }`}
            >
              <div
                className={`flex h-36 items-center justify-center text-6xl ${
                  exp.accent === "green"
                    ? "bg-gradient-to-br from-emerald to-emerald-bright"
                    : "bg-gradient-to-br from-crimson to-crimson-bright"
                }`}
              >
                <span aria-hidden>{exp.emoji}</span>
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
                  className={`mt-6 inline-block w-fit rounded px-5 py-2.5 text-xs font-extrabold uppercase tracking-wide text-white transition-opacity hover:opacity-90 ${
                    exp.accent === "green" ? "bg-emerald" : "bg-crimson"
                  } ${exp.id === "match" && hasLiveMatch ? "animate-pulse" : ""}`}
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
