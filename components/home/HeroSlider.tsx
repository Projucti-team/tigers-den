import Image from "next/image";
import Link from "next/link";

import { getMediaUrl } from "@/lib/data";
import type { HeroSlide } from "@/payload-types";

type Props = {
  slides: HeroSlide[];
};

export function HeroSlider({ slides }: Props) {
  if (slides.length === 0) return null;

  const slide = slides[0];
  const imageUrl = getMediaUrl(
    typeof slide.image === "object" ? slide.image : null,
  );

  return (
    <section className="fan-card relative overflow-hidden">
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt={slide.title}
          fill
          className="object-cover"
          priority
          sizes="(max-width: 1440px) 100vw, 1440px"
        />
      ) : null}

      <div
        className="absolute inset-0 bg-gradient-to-br from-emerald/90 via-emerald/70 to-crimson/85"
        aria-hidden
      />
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "repeating-linear-gradient(-45deg, transparent, transparent 8px, rgba(255,255,255,0.1) 8px, rgba(255,255,255,0.1) 16px)",
        }}
        aria-hidden
      />

      <div className="relative z-10 flex min-h-[240px] flex-col justify-end p-6 md:min-h-[300px] md:p-10">
        <span className="inline-flex w-fit rounded-full border-2 border-amber bg-crimson px-4 py-1 font-display text-xs font-extrabold uppercase tracking-widest text-white shadow-lg">
          🔥 Featured
        </span>
        <h1 className="mt-3 max-w-2xl font-display text-3xl font-extrabold uppercase leading-tight text-white drop-shadow-lg md:text-5xl">
          {slide.title}
        </h1>
        {slide.subtitle && (
          <p className="mt-2 max-w-xl text-base font-semibold text-white/95 md:text-lg">
            {slide.subtitle}
          </p>
        )}
        {slide.ctaLabel && slide.ctaUrl && (
          <Link
            href={slide.ctaUrl}
            className="fan-btn-amber mt-5 inline-flex w-fit rounded-xl px-6 py-3 text-sm hover:translate-y-0.5"
          >
            {slide.ctaLabel} →
          </Link>
        )}
      </div>
    </section>
  );
}
