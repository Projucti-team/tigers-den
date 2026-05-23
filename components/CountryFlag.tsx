"use client";

import { useEffect, useState } from "react";

import { flagEmoji, flagImageUrl, flagLabel } from "@/lib/cricket/tour-flags";

type Size = "sm" | "md" | "lg";

const CDN_WIDTH: Record<Size, number> = {
  sm: 80,
  md: 160,
  lg: 320,
};

const DISPLAY: Record<Size, { w: number; h: number; emoji: string }> = {
  sm: { w: 40, h: 28, emoji: "text-2xl" },
  md: { w: 80, h: 54, emoji: "text-5xl" },
  lg: { w: 120, h: 80, emoji: "text-7xl" },
};

type Props = {
  iso: string;
  size?: Size;
  className?: string;
  label?: string;
};

export function CountryFlag({ iso, size = "md", className = "", label }: Props) {
  const code = iso.toLowerCase();
  const cdnSrc = flagImageUrl(code, CDN_WIDTH[size]);
  const { w, h, emoji } = DISPLAY[size];
  const alt = label ?? flagLabel(code);

  const [src, setSrc] = useState(cdnSrc);
  const [useEmoji, setUseEmoji] = useState(false);

  useEffect(() => {
    setSrc(cdnSrc);
    setUseEmoji(false);
  }, [cdnSrc]);

  if (useEmoji) {
    return (
      <span
        className={`inline-flex items-center justify-center rounded shadow-sm ring-2 ring-white/50 ${emoji} leading-none ${className}`}
        role="img"
        aria-label={`${alt} flag`}
      >
        {flagEmoji(code)}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      width={w}
      height={h}
      alt={alt}
      className={`rounded object-cover shadow-sm ring-2 ring-white/50 ${className}`}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setUseEmoji(true)}
    />
  );
}
