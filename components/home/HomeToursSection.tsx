import type { TourCard } from "@/lib/cricket/services/tours-display";

type Props = {
  tours: TourCard[];
};

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      width={20}
      height={20}
    >
      <path d="M12 3 3 10.5V21h6v-6h6v6h6v-10.5L12 3z" />
    </svg>
  );
}

function PlaneIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      width={20}
      height={20}
    >
      <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
    </svg>
  );
}

function TourCardArticle({ tour }: { tour: TourCard }) {
  const isHome = tour.isHomeSeries;
  const border = isHome ? "border-emerald" : "border-crimson";
  const headerBg = isHome ? "bg-emerald" : "bg-crimson";
  const buttonBg = isHome ? "bg-emerald hover:bg-emerald-bright" : "bg-crimson hover:bg-crimson-bright";

  return (
    <article className={`relative overflow-hidden rounded-lg border-2 ${border} bg-surface shadow-sm`}>
      <span
        className={`absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white/40 bg-white/95 shadow-md ${
          isHome ? "text-emerald" : "text-crimson"
        }`}
        title={isHome ? "Home series" : "Away series"}
        aria-label={isHome ? "Home series in Bangladesh" : "Away series overseas"}
      >
        {isHome ? <HomeIcon /> : <PlaneIcon />}
      </span>

      <div className={`relative flex h-28 items-center justify-center text-5xl ${headerBg}`}>
        <span aria-hidden>{tour.emoji}</span>
      </div>

      <div className="p-5">
        <p className="font-mono text-[10px] font-bold uppercase tracking-wide text-charcoal/45">
          {tour.dateRange}
        </p>
        <h3 className="mt-1 pr-10 font-display text-sm font-extrabold uppercase leading-snug text-charcoal">
          {tour.title}
        </h3>
        <p className="mt-2 text-sm text-charcoal/75">{tour.description}</p>
        <button
          type="button"
          className={`mt-4 w-full rounded py-2.5 text-xs font-extrabold uppercase text-white transition-colors ${buttonBg}`}
        >
          View Itinerary &amp; Pricing
        </button>
      </div>
    </article>
  );
}

export function HomeToursSection({ tours }: Props) {
  return (
    <section id="tours" className="scroll-mt-24 bg-white py-14 md:scroll-mt-28 md:py-20">
      <div className="mx-auto max-w-[1440px] px-4 md:px-8">
        <h2 className="mx-auto max-w-xl text-balance text-center font-display text-xl font-extrabold uppercase leading-snug sm:text-2xl md:max-w-2xl md:text-3xl">
          <span className="text-emerald">Be part</span> of the biggest moments
          <span className="text-crimson"> — on tour</span>
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
            {tours.map((tour) => (
              <TourCardArticle key={tour.id} tour={tour} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
