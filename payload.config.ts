import { lexicalEditor } from "@payloadcms/richtext-lexical";
import path from "path";
import { buildConfig } from "payload";
import sharp from "sharp";
import { fileURLToPath } from "url";

import { HeroSlides } from "./collections/HeroSlides";
import { Media } from "./collections/Media";
import { Posts } from "./collections/Posts";
import { Users } from "./collections/Users";
import { getPayloadDatabase } from "./lib/payload-db";
import { getPayloadPlugins } from "./lib/payload-plugins";

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

function getServerURL(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export default buildConfig({
  serverURL: getServerURL(),
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    meta: {
      titleSuffix: "— The Tigers' Den",
    },
  },
  collections: [Users, Media, Posts, HeroSlides],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || "",
  typescript: {
    outputFile: path.resolve(dirname, "payload-types.ts"),
  },
  db: getPayloadDatabase(),
  plugins: getPayloadPlugins(),
  sharp,
  upload: {
    limits: {
      fileSize: 5_000_000,
    },
  },
});
