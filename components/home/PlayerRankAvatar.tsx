"use client";

import { useState } from "react";

type Props = {
  src: string;
  fallbackSrc: string;
  alt: string;
  className?: string;
};

export function PlayerRankAvatar({ src, fallbackSrc, alt, className }: Props) {
  const [imgSrc, setImgSrc] = useState(src);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imgSrc}
      alt={alt}
      width={56}
      height={56}
      className={className}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => {
        if (imgSrc !== fallbackSrc) setImgSrc(fallbackSrc);
      }}
    />
  );
}
