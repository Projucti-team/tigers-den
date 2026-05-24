import sharp from "sharp";

const HEIC_TYPES = new Set(["image/heic", "image/heif"]);
const HEIC_EXT = /\.(heic|heif)$/i;

const BROWSER_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export const UNSUPPORTED_PHOTO_MESSAGE =
  "This photo format is not supported in browsers (e.g. iPhone HEIC). Save as JPEG or PNG, or pick a different image.";

export function isHeicUpload(file: File): boolean {
  const type = file.type.toLowerCase();
  return HEIC_TYPES.has(type) || HEIC_EXT.test(file.name);
}

export function isBrowserSafeImageType(file: File): boolean {
  if (isHeicUpload(file)) return false;
  if (BROWSER_IMAGE_TYPES.has(file.type.toLowerCase())) return true;
  return /\.(jpe?g|png|webp|gif)$/i.test(file.name);
}

/** Normalize uploads to JPEG so avatars and post images render in all browsers. */
export async function prepareUploadImage(file: File): Promise<{
  buffer: Buffer;
  mimetype: string;
  name: string;
}> {
  if (isHeicUpload(file)) {
    throw new Error("HEIC_UNSUPPORTED");
  }

  if (!file.type.startsWith("image/") && !isBrowserSafeImageType(file)) {
    throw new Error("INVALID_IMAGE");
  }

  const input = Buffer.from(await file.arrayBuffer());
  const baseName = file.name.replace(/\.[^.]+$/, "") || "upload";

  try {
    const buffer = await sharp(input)
      .rotate()
      .jpeg({ quality: 88, mozjpeg: true })
      .toBuffer();

    return {
      buffer,
      mimetype: "image/jpeg",
      name: `${baseName}.jpg`,
    };
  } catch {
    if (!isBrowserSafeImageType(file)) {
      throw new Error("CONVERT_FAILED");
    }

    return {
      buffer: input,
      mimetype: file.type || "image/jpeg",
      name: file.name,
    };
  }
}

export function uploadImageErrorMessage(code: string): string {
  switch (code) {
    case "HEIC_UNSUPPORTED":
      return UNSUPPORTED_PHOTO_MESSAGE;
    case "INVALID_IMAGE":
      return "Please choose a JPEG, PNG, WebP, or GIF image.";
    case "CONVERT_FAILED":
      return UNSUPPORTED_PHOTO_MESSAGE;
    default:
      return "Could not process this image. Try a JPEG or PNG file.";
  }
}
