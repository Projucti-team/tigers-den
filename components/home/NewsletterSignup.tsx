export function NewsletterSignup() {
  return (
    <section className="bg-charcoal py-14 md:py-16">
      <div className="mx-auto max-w-[1440px] px-4 md:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-2xl font-extrabold uppercase text-white md:text-3xl">
            Become a supporter…
          </h2>
          <p className="mt-3 text-sm text-white/75">
            Be first to know about tickets, tours, chants and everything Tigers&apos; Den.
          </p>
        </div>

        <form className="mx-auto mt-8 max-w-xl space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="first-name" className="sr-only">
                First name
              </label>
              <input
                id="first-name"
                type="text"
                placeholder="First Name *"
                required
                className="w-full rounded border-2 border-emerald bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-amber"
              />
            </div>
            <div>
              <label htmlFor="last-name" className="sr-only">
                Last name
              </label>
              <input
                id="last-name"
                type="text"
                placeholder="Last Name *"
                required
                className="w-full rounded border-2 border-emerald bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-amber"
              />
            </div>
          </div>
          <input
            type="email"
            placeholder="Email Address *"
            required
            className="w-full rounded border-2 border-emerald bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-amber"
          />
          <label className="flex items-start gap-2 text-left text-xs text-white/70">
            <input type="checkbox" required className="mt-0.5 accent-crimson" />
            I agree to be contacted by The Tigers&apos; Den with the latest news and updates.
          </label>
          <button
            type="submit"
            className="w-full rounded bg-crimson py-4 font-display text-sm font-extrabold uppercase tracking-wide text-white hover:bg-crimson-bright"
          >
            Submit
          </button>
        </form>
      </div>
    </section>
  );
}
