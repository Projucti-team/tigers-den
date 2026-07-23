import { withPayload } from "@payloadcms/next/withPayload";
import type { NextConfig } from "next";

// Standalone is for Docker/Coolify VPS deployments.
const nextConfig: NextConfig = {
  ...(process.env.DOCKER_BUILD === "1" ? { output: "standalone" as const } : {}),
  // playwright-core does dynamic requires to locate its browser binary -- webpack bundling
  // that breaks it. Keep it as a plain external so Next just `require()`s it from
  // node_modules at runtime (same reason "sharp" is externalized by Next by default).
  serverExternalPackages: ["playwright-core"],
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
        protocol: "https",
        hostname: "h.cricapi.com",
      },
      {
        protocol: "https",
        hostname: "a.espncdn.com",
      },
      {
        protocol: "https",
        hostname: "images.icc-cricket.com",
      },
      {
        protocol: "https",
        hostname: "flagcdn.com",
      },
      {
        protocol: "http",
        hostname: "cricapi.com",
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
