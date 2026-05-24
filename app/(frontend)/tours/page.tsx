import Link from "next/link";

import { PageHero } from "@/components/pages/PageHero";
import { getToursIndexSnapshot } from "@/lib/cricket/services/tours";

export const metadata = {
  title: "Tours — The Tigers' Den",
  description: "Upcoming Bangladesh cricket series — fixtures, squads, venues and travel guides.",
};

export default async function ToursPage() {
  const snapshot = await getToursIndexSnapshot();
  const cards = snapshot?.cards ?? [];
  const warnings = snapshot?.warnings ?? [];
  if (!snapshot) {
    warnings.push(
      "Tour data not loaded yet. Run `npm run sync:cricket` or wait for the nightly refresh (~3:00 AM BDT).",
    );
  }

  return (
    <>
      <PageHero
        label="Tours"
        title="Upcoming series"
        subtitle="Every future Bangladesh series — squads, fixtures, venues, and what to expect in each host city."
      />

      <div className="mx-auto max-w-[1440px] px-4 py-10 md:px-8">
        {warnings.length > 0 ? (
          <ul className="mb-6 space-y-1 rounded border border-amber/40 bg-amber/10 px-4 py-3 text-xs text-charcoal/75">
            {warnings.map((w) => (
              <li key={w}>• {w}</li>
            ))}
          </ul>
        ) : null}

        {cards.length === 0 ? (
          <p className="text-center text-sm text-charcoal/60">
            No upcoming series listed right now. Check back soon or head to the{" "}
            <Link href="/match-centre" className="font-semibold text-emerald hover:underline">
              Match Centre
            </Link>
            .
          </p>
        ) : (
          <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {cards.map((card) => (
              <li key={card.id}>
                <Link
                  href={card.href}
                  className={`fan-card block h-full border-4 p-6 transition-transform hover:-translate-y-1 ${
                    card.accent === "green" ? "border-emerald" : "border-crimson"
                  }`}
                >
                  <p className="font-display text-lg font-extrabold uppercase text-charcoal">
                    {card.title}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-emerald">{card.dateRange}</p>
                  <p className="mt-2 text-sm text-charcoal/65">{card.description}</p>
                  <span className="fan-btn-green mt-4 inline-block rounded px-4 py-2 text-xs">
                    Series details →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
