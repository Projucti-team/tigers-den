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
    <section className="relative min-h-[420px] overflow-hidden bg-charcoal md:min-h-[520px]">
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
          <div
            className="absolute inset-0 bg-gradient-to-r from-emerald/85 via-emerald/70 to-crimson/80"
            aria-hidden
          />
        </>
      ) : (
        <div
          className="absolute inset-0 bg-gradient-to-br from-emerald via-emerald/80 to-crimson"
          aria-hidden
        />
      )}

      <div className="relative z-10 mx-auto flex min-h-[420px] max-w-[1440px] flex-col items-center justify-center px-4 py-16 text-center md:min-h-[520px] md:px-8 md:py-24">
        <p className="font-display text-3xl font-extrabold uppercase tracking-[0.15em] text-amber drop-shadow-lg md:text-5xl lg:text-6xl">
          Join The Tigers&apos; Den
        </p>
        {slide?.subtitle ? (
          <p className="mx-auto mt-5 max-w-2xl text-base text-white/95 drop-shadow md:text-lg">
            {slide.subtitle}
          </p>
        ) : (
          <p className="mx-auto mt-5 max-w-2xl text-base text-white/90 md:text-lg">
            The home of passionate Bangladesh cricket fans — live scores, community, and match day
            spirit.
          </p>
        )}
        <div className="mt-8 flex justify-center">
          <Link
            href="#membership"
            className="inline-block rounded border-2 border-white px-8 py-4 font-display text-sm font-extrabold uppercase tracking-wide text-white transition-colors hover:bg-white hover:text-emerald"
          >
            Become a Member
          </Link>
        </div>
      </div>
    </section>
  );
}
