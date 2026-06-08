import Link from "next/link";

import type { ProfileTabGuide as TabGuide } from "@/lib/profile/tab-guides";

type ProfileTabGuideProps = {
  guide: TabGuide;
  /** Shorter copy when viewing someone else's profile */
  viewingOthers?: boolean;
  comingSoon?: boolean;
  comingSoonMessage?: string;
};

export function ProfileTabGuide({
  guide,
  viewingOthers = false,
  comingSoon = false,
  comingSoonMessage,
}: ProfileTabGuideProps) {
  if (viewingOthers) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
        <p className="text-xs leading-relaxed text-white/55">
          <span className="font-bold uppercase tracking-wide text-white/70">
            {guide.title}
          </span>
          {" — "}
          {guide.tagline}
        </p>
      </div>
    );
  }

  return (
    <section
      className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-md"
      aria-labelledby={`guide-${guide.id}`}
    >
      <div
        className={`border-b border-white/10 px-4 py-3 ${
          guide.id === "chants" ? "bg-crimson/20" : "bg-emerald/15"
        }`}
      >
        <h2
          id={`guide-${guide.id}`}
          className="font-display text-sm font-extrabold uppercase tracking-wide text-white"
        >
          {guide.title}
        </h2>
        <p className="mt-0.5 text-xs font-semibold text-emerald-glow/90">{guide.tagline}</p>
      </div>

      <div className="space-y-4 p-4">
        <p className="text-sm leading-relaxed text-white/75">{guide.description}</p>

        {guide.useFor.length > 0 ? (
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-white/45">
              Good for
            </p>
            <ul className="mt-2 space-y-1.5">
              {guide.useFor.map((item) => (
                <li
                  key={item}
                  className="flex gap-2 text-xs leading-relaxed text-white/65 before:shrink-0 before:font-bold before:text-emerald-glow before:content-['•']"
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {guide.notFor ? (
          <p className="rounded-lg border border-amber/25 bg-amber/5 px-3 py-2 text-xs leading-relaxed text-amber/90">
            <span className="font-bold uppercase tracking-wide">Not for: </span>
            {guide.notFor}
          </p>
        ) : null}

        {guide.examples.length > 0 ? (
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-white/45">
              Examples
            </p>
            <ul className="mt-2 space-y-2">
              {guide.examples.map((ex) => (
                <li
                  key={ex.label}
                  className="rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2"
                >
                  <span className="text-[10px] font-extrabold uppercase tracking-wide text-white/40">
                    {ex.label}
                  </span>
                  <p className="mt-1 text-xs italic leading-relaxed text-white/60">
                    &ldquo;{ex.text}&rdquo;
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {comingSoon ? (
          <p className="rounded-lg border border-dashed border-white/15 px-3 py-3 text-center text-xs text-white/50">
            {comingSoonMessage ??
              "Submitting from your profile is coming soon. Until then, browse threads on The Stand."}
          </p>
        ) : null}

        {guide.ctaHref && guide.ctaLabel ? (
          <Link
            href={guide.ctaHref}
            className={`inline-block rounded-lg px-4 py-2 text-xs font-extrabold uppercase ${
              guide.id === "chants"
                ? "border-2 border-crimson text-crimson-glow hover:bg-crimson/10"
                : "fan-btn-green"
            }`}
          >
            {guide.ctaLabel}
          </Link>
        ) : null}
      </div>
    </section>
  );
}
