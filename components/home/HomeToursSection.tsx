import type { TourCard } from "@/lib/cricket/services/tours-display";

type Props = {
  tours: TourCard[];
};

export function HomeToursSection({ tours }: Props) {
  return (
    <section id="tours" className="bg-white py-14 md:py-20">
      <div className="mx-auto max-w-[1440px] px-4 md:px-8">
        <h2 className="text-center font-display text-2xl font-extrabold uppercase md:text-3xl">
          <span className="text-emerald">Be part</span> of the biggest moments —{" "}
          <span className="text-crimson">on tour</span>
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-center text-charcoal/75">
          Our team organises everything — flights, hotels, transfers, match tickets and more.
        </p>

        {tours.length === 0 ? (
          <p className="mt-10 text-center text-sm font-semibold text-charcoal/50">
            Upcoming Bangladesh series will appear here once fixture data is available.
          </p>
        ) : (
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {tours.map((tour, i) => (
              <article
                key={tour.id}
                className="overflow-hidden rounded-lg border-2 border-emerald/30 bg-surface shadow-sm"
              >
                <div
                  className={`flex h-28 items-center justify-center text-5xl ${
                    i === 0
                      ? "bg-emerald"
                      : i === 1
                        ? "bg-crimson"
                        : "bg-gradient-to-r from-emerald to-crimson"
                  }`}
                >
                  <span aria-hidden>{tour.emoji}</span>
                </div>
                <div className="p-5">
                  <p className="font-mono text-[10px] font-bold uppercase tracking-wide text-charcoal/45">
                    {tour.dateRange}
                  </p>
                  <h3 className="mt-1 font-display text-sm font-extrabold uppercase leading-snug text-charcoal">
                    {tour.title}
                  </h3>
                  <p className="mt-2 text-sm text-charcoal/75">{tour.description}</p>
                  {tour.isHomeSeries && (
                    <p className="mt-2 text-xs font-bold uppercase text-emerald">Home series</p>
                  )}
                  <button
                    type="button"
                    className={`mt-4 w-full rounded py-2.5 text-xs font-extrabold uppercase text-white ${
                      tour.accent === "green" ? "bg-emerald" : "bg-crimson"
                    }`}
                  >
                    View Itinerary &amp; Pricing
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
