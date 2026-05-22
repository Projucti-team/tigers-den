import { whyJoin } from "@/lib/site-content";

export function WhyJoinSection() {
  return (
    <section className="bg-white py-14 md:py-20">
      <div className="mx-auto max-w-[1440px] px-4 md:px-8">
        <h2 className="text-center font-display text-2xl font-extrabold uppercase text-charcoal md:text-3xl">
          Why choose the Tigers&apos; Den travel experience?
        </h2>

        <div className="mt-12 grid gap-8 md:grid-cols-3">
          {whyJoin.map((item, i) => (
            <article key={item.title} className="text-center md:text-left">
              <span
                className={`inline-flex h-14 w-14 items-center justify-center rounded-full font-display text-xl font-extrabold text-white ${
                  i === 1 ? "bg-crimson" : "bg-emerald"
                }`}
              >
                {i + 1}
              </span>
              <h3 className="mt-4 font-display text-base font-extrabold uppercase text-emerald">
                {item.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-charcoal/80">{item.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
