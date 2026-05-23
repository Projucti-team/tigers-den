import { withPayload } from "@payloadcms/next/withPayload";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        pathname: "/api/media/**",
      },
      {
        protocol: "https",
        hostname: "**",
        pathname: "/api/media/**",
      },
      {
        protocol: "https",
        hostname: "ui-avatars.com",
      },
      {
        protocol: "https",
        hostname: "www.cricapi.com",
      },
      {
        protocol: "https",
        hostname: "cdn.cricapi.com",
      },
      {
        protocol: "http",
        hostname: "cricapi.com",
      },
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
      },
      {
        protocol: "https",
        hostname: "p.imgci.com",
      },
      {
        protocol: "https",
        hostname: "static.cricbuzz.com",
      },
    ],
  },
};

export default withPayload(nextConfig);
