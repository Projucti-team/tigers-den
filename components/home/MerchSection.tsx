import Link from "next/link";

import { ComingSoonBadge } from "@/components/ui/ComingSoonBadge";
import { merchCategories } from "@/lib/site-content";

export function MerchSection() {
  return (
    <section id="shop" className="border-t-4 border-amber/80 py-14 md:py-20">
      <div className="mx-auto max-w-[1440px] px-4 md:px-8">
        <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="font-display text-2xl font-extrabold uppercase md:text-3xl">
                <span className="fan-gradient-text">Shop Merchandise</span>
              </h2>
              <ComingSoonBadge />
            </div>
            <p className="mt-2 max-w-xl text-white/75">
              Polo shirts, bucket hats, scarves and bespoke memorabilia — the Tigers&apos; Den store
              opens soon.
            </p>
          </div>
          <Link href="/shop" className="fan-btn-green rounded px-6 py-3 text-xs">
            Shop — coming soon →
          </Link>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-4">
          {merchCategories.map((cat, i) => (
            <Link
              key={cat.name}
              href={cat.href}
              className={`fan-vibrant-card group relative rounded-lg border-2 p-6 text-center transition-all hover:-translate-y-2 ${
                i % 2 === 0
                  ? "border-emerald bg-white hover:border-emerald-bright"
                  : "border-crimson bg-white hover:border-crimson-bright"
              }`}
            >
              <ComingSoonBadge compact className="absolute right-2 top-2" />
              <span className="text-4xl" aria-hidden>
                {cat.emoji}
              </span>
              <p className="mt-3 font-display text-sm font-extrabold uppercase text-charcoal group-hover:text-emerald">
                {cat.name}
              </p>
              <p className="mt-1 text-xs font-bold uppercase text-crimson/80">Coming soon</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
