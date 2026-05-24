type FanMarqueeProps = {
  items: string[];
};

export function FanMarquee({ items }: FanMarqueeProps) {
  const loop = items.length > 0 ? [...items, ...items] : items;

  return (
    <div className="fan-gradient-bar animate-shimmer-bar overflow-hidden border-y-2 border-amber py-2.5">
      <div className="animate-marquee flex w-max whitespace-nowrap">
        {loop.map((text, i) => (
          <span
            key={`${text}-${i}`}
            className="mx-6 font-display text-sm font-extrabold tracking-widest text-white md:text-base"
          >
            {text}
          </span>
        ))}
      </div>
    </div>
  );
}
