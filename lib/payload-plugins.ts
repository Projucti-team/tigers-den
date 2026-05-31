import { vercelBlobStorage } from "@payloadcms/storage-vercel-blob";
import type { Plugin } from "payload";

/** Vercel Blob for CMS uploads in production (free tier). Local disk when unset. */
export function getPayloadPlugins(): Plugin[] {
  const token = process.env.BLOB_READ_WRITE_TOKEN;

  // Always register so `payload generate:importmap` includes the client upload handler.
  return [
    vercelBlobStorage({
      enabled: Boolean(token),
      collections: {
        media: {
          prefix: "media",
        },
      },
      token: token ?? "",
      // Hero images are well under Vercel's 4.5MB body limit; server uploads are more reliable
      // in the admin drawer than client-side blob uploads.
      clientUploads: false,
    }),
  ];
}
