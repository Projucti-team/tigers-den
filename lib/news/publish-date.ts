/** Sort unknown dates last instead of treating them as "just published". */
export const UNKNOWN_PUBLISH_DATE = "1970-01-01T00:00:00.000Z";

export function parsePublishDate(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;

  return parsed.toISOString();
}

export function parseRelativePublishDate(value: string, now = Date.now()): string | null {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;

  if (trimmed === "just now") {
    return new Date(now).toISOString();
  }

  if (trimmed === "yesterday") {
    return new Date(now - 24 * 60 * 60 * 1000).toISOString();
  }

  const ago = trimmed.match(/^(\d+)\s*([mhd])\s*ago$/);
  if (ago) {
    const amount = Number(ago[1]);
    const unit = ago[2];
    const ms =
      unit === "m"
        ? amount * 60 * 1000
        : unit === "h"
          ? amount * 60 * 60 * 1000
          : amount * 24 * 60 * 60 * 1000;
    return new Date(now - ms).toISOString();
  }

  return parsePublishDate(value);
}

export function resolvePublishDate(
  candidates: Array<string | undefined | null>,
  fallback = UNKNOWN_PUBLISH_DATE,
): string {
  for (const candidate of candidates) {
    if (!candidate) continue;

    const absolute = parsePublishDate(candidate);
    if (absolute) return absolute;

    const relative = parseRelativePublishDate(candidate);
    if (relative) return relative;
  }

  return fallback;
}

export function extractPublishDateFromHtml(html: string): string | null {
  const candidates = [
    html.match(/"datePublished"\s*:\s*"([^"]+)"/i)?.[1],
    html.match(/"Published"\s*:\s*"([^"]+)"/i)?.[1],
    html.match(/property="article:published_time"\s+content="([^"]+)"/i)?.[1],
    html.match(/<pubDate>([^<]+)<\/pubDate>/i)?.[1],
  ];

  return resolvePublishDate(candidates, "") || null;
}
