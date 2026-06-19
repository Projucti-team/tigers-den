type FanMarqueeProps = {
  items: string[];
};

export function FanMarquee({ items }: FanMarqueeProps) {
  const loop = items.length > 0 ? [...items, ...items] : items;

  return (
    <div className="relative overflow-hidden border-y-2 border-amber py-2.5">
      <div
        className="fan-gradient-bar animate-shimmer-bar fan-moving-bar-bg pointer-events-none absolute inset-0"
        aria-hidden
      />

      <div className="fan-marquee-fade relative z-10">
        <div className="animate-marquee flex w-max whitespace-nowrap">
          {loop.map((text, i) => (
            <span
              key={`${text}-${i}`}
              className="mx-6 font-display text-sm font-extrabold tracking-widest text-white drop-shadow-sm md:text-base"
            >
              {text}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
