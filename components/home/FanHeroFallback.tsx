export function FanHeroFallback() {
  return (
    <section className="fan-card relative overflow-hidden">
      <div
        className="absolute inset-0 bg-gradient-to-br from-emerald via-emerald-bright to-crimson"
        aria-hidden
      />
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg, #fff 0, #fff 2px, transparent 2px, transparent 24px)",
        }}
        aria-hidden
      />

      <div className="relative z-10 flex min-h-[200px] flex-col items-center justify-center p-8 text-center md:min-h-[260px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/tigers-den-logo.png"
          alt=""
          width={112}
          height={120}
          className="h-24 w-auto object-contain md:h-28"
          aria-hidden
        />
        <h1 className="mt-2 font-display text-3xl font-extrabold uppercase tracking-wider text-white drop-shadow-lg md:text-5xl">
          The Tigers&apos; <span className="text-amber">Den</span>
        </h1>
        <p className="mt-3 max-w-lg font-display text-sm font-bold uppercase tracking-[0.2em] text-white/90 md:text-base">
          Green &amp; Red Army · Roar for Bangladesh
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <span className="rounded-full border-2 border-white bg-emerald-glow/30 px-4 py-1.5 font-display text-xs font-extrabold uppercase text-white">
            Live Scores
          </span>
          <span className="rounded-full border-2 border-white bg-crimson-bright/50 px-4 py-1.5 font-display text-xs font-extrabold uppercase text-white">
            Fan Forum
          </span>
          <span className="rounded-full border-2 border-amber bg-amber px-4 py-1.5 font-display text-xs font-extrabold uppercase text-pitch">
            On Tour
          </span>
        </div>
      </div>
    </section>
  );
}
