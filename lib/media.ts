import type { Media } from "@/payload-types";

/** Turn Payload media into an absolute URL the browser can load */
export function getAbsoluteMediaUrl(
  media: number | Media | null | undefined,
): string | null {
  if (!media || typeof media === "number") return null;

  const raw = media.url ?? media.thumbnailURL ?? null;
  if (!raw) return null;

  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    return raw;
  }

  const base =
    process.env.NEXT_PUBLIC_SERVER_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3000";

  return `${base.replace(/\/$/, "")}${raw.startsWith("/") ? raw : `/${raw}`}`;
}
