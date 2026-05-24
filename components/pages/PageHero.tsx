type PageHeroProps = {
  label: string;
  title: string;
  subtitle?: string;
};

export function PageHero({ label, title, subtitle }: PageHeroProps) {
  return (
    <div className="border-b-4 border-crimson bg-emerald py-8 text-center text-white md:py-10">
      <p className="font-display text-xs font-bold uppercase tracking-widest text-amber">{label}</p>
      <h1 className="font-display mt-2 text-3xl font-extrabold uppercase md:text-4xl">{title}</h1>
      {subtitle ? (
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-white/85">{subtitle}</p>
      ) : null}
    </div>
  );
}
