import { membershipTiers } from "@/lib/site-content";

export function MembershipSection() {
  return (
    <section id="membership" className="bg-surface py-14 md:py-20">
      <div className="mx-auto max-w-[1440px] px-4 md:px-8">
        <div className="text-center">
          <h2 className="font-display text-2xl font-extrabold uppercase text-charcoal md:text-4xl">
            Join The Tigers&apos; Den!
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-charcoal/80">
            Membership affords priority tickets, member rewards, money-can&apos;t-buy opportunities
            and loads more — just like the world&apos;s best fan armies.
          </p>
        </div>

        <div className="mt-12 grid gap-8 md:grid-cols-3">
          {membershipTiers.map((tier) => (
            <article
              key={tier.name}
              className={`flex flex-col rounded-lg border-2 bg-white p-6 shadow-md ${
                tier.highlight
                  ? "border-crimson ring-4 ring-crimson/20 md:-translate-y-2"
                  : "border-emerald/30"
              }`}
            >
              {tier.highlight && (
                <span className="mb-3 w-fit rounded bg-crimson px-3 py-1 font-display text-[10px] font-extrabold uppercase text-white">
                  Most Popular
                </span>
              )}
              <p className="text-xs font-bold uppercase tracking-wide text-emerald">Membership</p>
              <h3 className="mt-1 font-display text-lg font-extrabold uppercase text-charcoal">
                {tier.name}
              </h3>
              <p className="mt-3 text-sm text-charcoal/75">{tier.description}</p>
              <ul className="mt-4 flex-1 space-y-2 text-sm">
                {tier.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <span className="text-crimson" aria-hidden>
                      ✓
                    </span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-6 font-display text-2xl font-extrabold text-emerald">
                {tier.price}
                <span className="ml-1 text-sm font-semibold text-charcoal/60">{tier.period}</span>
              </p>
              <button
                type="button"
                className={`mt-4 w-full rounded py-3 font-display text-xs font-extrabold uppercase text-white ${
                  tier.highlight ? "bg-crimson hover:bg-crimson-bright" : "bg-emerald hover:bg-emerald-bright"
                }`}
              >
                {tier.cta}
              </button>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
