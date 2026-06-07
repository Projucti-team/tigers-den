import { getPayloadServerURL } from "@/lib/payload-url";
import type { Media } from "@/payload-types";

type MediaWithSizes = Media & {
  sizes?: {
    hero?: { url?: string | null };
    thumbnail?: { url?: string | null };
  };
};

function toMediaPath(raw: string): string {
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    try {
      return new URL(raw).pathname;
    } catch {
      return raw;
    }
  }
  return raw.startsWith("/") ? raw : `/${raw}`;
}

function pickMediaPath(media: MediaWithSizes): string | null {
  const candidates = [
    media.sizes?.hero?.url,
    media.url,
    media.thumbnailURL,
    media.filename ? `/api/media/file/${media.filename}` : null,
  ];

  for (const raw of candidates) {
    if (raw) return toMediaPath(raw);
  }

  return null;
}

/** Same-origin path — safe for next/image on any host (LAN IP, Coolify domain, localhost). */
export function getRelativeMediaUrl(
  media: number | Media | null | undefined,
): string | null {
  if (!media || typeof media === "number") return null;
  return pickMediaPath(media);
}

/** Absolute URL for APIs / Open Graph (built from relative + public server URL). */
export function getAbsoluteMediaUrl(
  media: number | Media | null | undefined,
): string | null {
  const relative = getRelativeMediaUrl(media);
  if (!relative) return null;
  if (relative.startsWith("http://") || relative.startsWith("https://")) {
    return relative;
  }

  const base = getPayloadServerURL().replace(/\/$/, "");
  return `${base}${relative.startsWith("/") ? relative : `/${relative}`}`;
}

/** Same-origin path for <img src> — rewrites stale localhost absolute URLs from older API responses. */
export function resolveMediaSrc(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  const trimmed = url.trim();
  if (trimmed.startsWith("/")) return trimmed;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      const { pathname } = new URL(trimmed);
      if (pathname.startsWith("/api/media/")) return pathname;
      return trimmed;
    } catch {
      return trimmed;
    }
  }
  return `/${trimmed}`;
}
