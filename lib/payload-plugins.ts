import { vercelBlobStorage } from "@payloadcms/storage-vercel-blob";
import type { Plugin } from "payload";

/** Vercel Blob for CMS uploads in production (free tier). Local disk when unset. */
export function getPayloadPlugins(): Plugin[] {
  const token = process.env.BLOB_READ_WRITE_TOKEN;

  if (!token) return [];

  return [
    vercelBlobStorage({
      enabled: true,
      collections: {
        media: {
          prefix: "media",
        },
      },
      token,
      clientUploads: true,
    }),
  ];
}
