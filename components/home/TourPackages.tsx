import { mockTours } from "@/lib/data";

const cardStyles = [
  "border-emerald bg-gradient-to-br from-emerald/25 via-white to-emerald/10 hover:shadow-[0_0_24px_rgba(0,179,104,0.4)]",
  "border-crimson bg-gradient-to-br from-crimson/25 via-white to-crimson/10 hover:shadow-[0_0_24px_rgba(255,23,68,0.4)]",
  "border-emerald bg-gradient-to-br from-emerald/20 via-amber/10 to-crimson/20 hover:shadow-[0_0_24px_rgba(255,184,0,0.4)]",
];

const btnStyles = ["fan-btn-green", "fan-btn-red", "fan-btn-amber"];

export function TourPackages() {
  return (
    <section id="tours" className="fan-card p-4 md:p-6">
      <div className="mb-4 flex items-center gap-3">
        <span className="h-10 w-1.5 rounded-full bg-gradient-to-b from-emerald to-crimson" aria-hidden />
        <h2 className="font-display text-base font-extrabold uppercase tracking-wider fan-gradient-text md:text-lg">
          ✈️ Upcoming Tour &amp; Travel Packages
        </h2>
        <span className="h-10 w-1.5 rounded-full bg-gradient-to-b from-crimson to-emerald" aria-hidden />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {mockTours.map((tour, i) => (
          <article
            key={tour.title}
            className={`flex flex-col rounded-xl border-4 p-5 transition-all hover:-translate-y-1 ${cardStyles[i]}`}
          >
            <p className="text-4xl drop-shadow-md" aria-hidden>
              {tour.emoji}
            </p>
            <h3
              className={`mt-3 font-display text-sm font-extrabold uppercase ${i % 2 === 0 ? "text-emerald" : "text-crimson"}`}
            >
              {tour.title}
            </h3>
            <p className="mt-2 flex-1 text-sm font-medium text-charcoal">{tour.description}</p>
            <button
              type="button"
              className={`mt-5 w-full rounded-xl py-3 text-xs ${btnStyles[i]} hover:translate-y-0.5`}
            >
              View Packages →
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
