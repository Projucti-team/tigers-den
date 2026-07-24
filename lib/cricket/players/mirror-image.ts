import { getPayloadClient } from "@/lib/payload";
import { getAbsoluteMediaUrl } from "@/lib/media";

const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/** Headshots are small; anything past this is almost certainly the wrong content-type slipping through. */
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

function slugifyName(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "player"
  );
}

export type MirroredImage = { mediaId: number; url: string | null };

/**
 * Download an external player headshot (ICC / Cricinfo / CricAPI CDN) and store our own copy
 * in the Media collection, so the site never hot-links third-party image CDNs. Best-effort:
 * any failure (network, non-image content, oversized response) just returns null so the
 * caller can fall back to showing the raw external URL rather than nothing.
 */
export async function mirrorPlayerImage(
  sourceUrl: string,
  playerName: string,
): Promise<MirroredImage | null> {
  try {
    const res = await fetch(sourceUrl, {
      headers: { "User-Agent": BROWSER_USER_AGENT, Accept: "image/*" },
      cache: "no-store",
    });
    if (!res.ok) return null;

    const contentType = (res.headers.get("content-type") ?? "").split(";")[0].trim();
    const ext = EXTENSION_BY_MIME[contentType];
    if (!ext) return null; // not a recognized image type -- don't guess

    const arrayBuffer = await res.arrayBuffer();
    if (arrayBuffer.byteLength === 0 || arrayBuffer.byteLength > MAX_IMAGE_BYTES) return null;

    const buffer = Buffer.from(arrayBuffer);
    const filename = `player-${slugifyName(playerName)}-${Date.now()}.${ext}`;

    const payload = await getPayloadClient();
    const doc = await payload.create({
      collection: "media",
      data: { alt: `${playerName} headshot` },
      file: {
        data: buffer,
        mimetype: contentType,
        name: filename,
        size: buffer.length,
      },
      overrideAccess: true,
    });

    return { mediaId: doc.id as number, url: getAbsoluteMediaUrl(doc as never) };
  } catch {
    return null;
  }
}

/** Resolve an already-mirrored (or manually uploaded) photo id to its public URL. */
export async function resolvePhotoUrl(photoId: number): Promise<string | null> {
  try {
    const payload = await getPayloadClient();
    const media = await payload.findByID({
      collection: "media",
      id: photoId,
      overrideAccess: true,
    });
    return getAbsoluteMediaUrl(media as never);
  } catch {
    return null;
  }
}
