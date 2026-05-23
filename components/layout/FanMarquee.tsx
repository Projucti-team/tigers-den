const items = [
  "🐅 THE TIGERS' DEN",
  "🇧🇩 GREEN & RED ARMY",
  "🔥 ROAR FOR BANGLADESH",
  "🏏 LIVE MATCH CENTRE",
  "📣 CHANTS • TRAVEL • FORUM",
  "🐅 THE TIGERS' DEN",
  "🇧🇩 GREEN & RED ARMY",
  "🔥 ROAR FOR BANGLADESH",
  "🏏 LIVE MATCH CENTRE",
  "📣 CHANTS • TRAVEL • FORUM",
];

export function FanMarquee() {
  return (
    <div className="fan-gradient-bar animate-shimmer-bar overflow-hidden border-y-2 border-amber py-2.5">
      <div className="animate-marquee flex w-max whitespace-nowrap">
        {[...items, ...items].map((text, i) => (
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
