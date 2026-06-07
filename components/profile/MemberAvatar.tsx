"use client";

import { useEffect, useState } from "react";

export const DEFAULT_MEMBER_AVATAR = "/tigers-den-logo-nav.png";

/** OAuth profile photos are not used — site logo or uploaded media only. */
function isOAuthProviderPhoto(url: string): boolean {
  return /googleusercontent\.com|ggpht\.com|facebook\.com|fbcdn\.net/i.test(url);
}

export function getMemberAvatarSrc(avatarUrl?: string | null): string {
  const trimmed = avatarUrl?.trim();
  if (!trimmed || trimmed === "null" || trimmed === "undefined") {
    return DEFAULT_MEMBER_AVATAR;
  }
  if (isOAuthProviderPhoto(trimmed)) {
    return DEFAULT_MEMBER_AVATAR;
  }
  return trimmed;
}

export function isDefaultMemberAvatar(src: string): boolean {
  return src === DEFAULT_MEMBER_AVATAR || src.endsWith("tigers-den-logo-nav.png");
}

type MemberAvatarProps = {
  avatarUrl?: string | null;
  name: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
};

const sizeClasses = {
  sm: "h-10 w-10 shrink-0",
  md: "h-11 w-11 shrink-0",
  lg: "h-20 w-20 shrink-0",
  xl: "h-28 w-28 shrink-0 md:h-32 md:w-32",
} as const;

export function MemberAvatar({ avatarUrl, name, size = "sm", className = "" }: MemberAvatarProps) {
  const [src, setSrc] = useState(() => getMemberAvatarSrc(avatarUrl));

  useEffect(() => {
    setSrc(getMemberAvatarSrc(avatarUrl));
  }, [avatarUrl]);

  const isDefault = isDefaultMemberAvatar(src);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={src}
      src={src}
      alt=""
      title={name}
      onError={() => {
        if (!isDefaultMemberAvatar(src)) {
          setSrc(DEFAULT_MEMBER_AVATAR);
        }
      }}
      className={`rounded-full ${sizeClasses[size]} ${
        isDefault ? "bg-white object-contain p-1.5" : "object-cover"
      } ${className}`}
    />
  );
}
