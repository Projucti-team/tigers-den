import Image from "next/image";
import Link from "next/link";

import { getAbsoluteMediaUrl } from "@/lib/media";
import type { HeroSlide } from "@/payload-types";

type Props = {
  slides?: HeroSlide[];
};

export function HeroPromo({ slides = [] }: Props) {
  const slide = slides[0];
  const imageUrl = slide ? getAbsoluteMediaUrl(slide.image) : null;
  const imageAlt =
    slide && typeof slide.image === "object" && slide.image?.alt
      ? slide.image.alt
      : slide?.title ?? "Hero banner";

  return (
    <section className="relative min-h-[460px] overflow-hidden md:min-h-[560px]">
      {imageUrl ? (
        <>
          <Image
            src={imageUrl}
            alt={imageAlt}
            fill
            className="object-cover"
            priority
            sizes="100vw"
            unoptimized
          />
          <div className="fan-hero-mesh absolute inset-0" aria-hidden />
        </>
      ) : (
        <div
          className="absolute inset-0 bg-gradient-to-br from-emerald via-emerald/90 to-crimson"
          aria-hidden
        />
      )}

      <div className="fan-hero-stripes pointer-events-none absolute inset-0" aria-hidden />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-pitch to-transparent"
        aria-hidden
      />

      <div className="relative z-10 mx-auto flex min-h-[460px] max-w-[1440px] flex-col items-center justify-center px-4 py-16 text-center md:min-h-[560px] md:px-8 md:py-24">
        <p className="fan-section-label mb-6 text-amber">🇧🇩 Bangladesh Fan Army</p>
        <h1 className="font-display text-4xl font-extrabold uppercase leading-[0.95] tracking-tight text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.5)] md:text-6xl lg:text-7xl">
          <span className="text-emerald-glow">Join</span> The Tigers&apos; Den
        </h1>
        {slide?.subtitle ? (
          <p className="mx-auto mt-6 max-w-2xl text-base font-medium text-white/95 drop-shadow md:text-xl">
            {slide.subtitle}
          </p>
        ) : (
          <p className="mx-auto mt-6 max-w-2xl text-base text-white/90 md:text-lg">
            The home of passionate Bangladesh cricket fans — live scores, community, and match day
            spirit.
          </p>
        )}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link href="#membership" className="fan-btn-green rounded px-8 py-4 text-sm">
            Become a Member
          </Link>
          <Link href="#rankings" className="fan-btn-red rounded px-8 py-4 text-sm">
            ICC Rankings
          </Link>
        </div>
      </div>
    </section>
  );
}
