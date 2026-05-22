import Link from "next/link";

import { merchCategories } from "@/lib/site-content";

export function MerchSection() {
  return (
    <section id="shop" className="border-t-4 border-emerald bg-gradient-to-b from-emerald/5 to-white py-14 md:py-20">
      <div className="mx-auto max-w-[1440px] px-4 md:px-8">
        <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h2 className="font-display text-2xl font-extrabold uppercase text-charcoal md:text-3xl">
              Shop Merchandise
            </h2>
            <p className="mt-2 max-w-xl text-charcoal/75">
              Polo shirts, bucket hats, scarves and bespoke memorabilia — something for every
              Bangladesh cricket fan.
            </p>
          </div>
          <Link
            href="#shop"
            className="rounded bg-emerald px-6 py-3 font-display text-xs font-extrabold uppercase text-white hover:bg-emerald-bright"
          >
            View Shop →
          </Link>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-4">
          {merchCategories.map((cat, i) => (
            <Link
              key={cat.name}
              href={cat.href}
              className={`group rounded-lg border-2 p-6 text-center transition-all hover:-translate-y-1 hover:shadow-lg ${
                i % 2 === 0
                  ? "border-emerald bg-white hover:border-emerald-bright"
                  : "border-crimson bg-white hover:border-crimson-bright"
              }`}
            >
              <span className="text-4xl" aria-hidden>
                {cat.emoji}
              </span>
              <p className="mt-3 font-display text-sm font-extrabold uppercase text-charcoal group-hover:text-emerald">
                {cat.name}
              </p>
              <p className="mt-1 text-xs font-bold uppercase text-crimson">View collection →</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
