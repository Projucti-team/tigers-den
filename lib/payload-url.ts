/** Public site URL used by Payload (admin API, cookies, CSRF). */
export function getPayloadServerURL(): string {
  if (process.env.VERCEL_URL && process.env.VERCEL_ENV !== "production") {
    return `https://${process.env.VERCEL_URL}`;
  }

  const fromEnv =
    process.env.NEXT_PUBLIC_SERVER_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : undefined);

  if (fromEnv) return fromEnv.replace(/\/$/, "");

  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;

  return "http://localhost:3000";
}

/** HTTP + HTTPS variants so cookie auth works when env URL scheme differs from the browser. */
export function getPayloadTrustedOrigins(): string[] {
  const candidates = [
    process.env.NEXT_PUBLIC_SERVER_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.NEXTAUTH_URL,
    process.env.AUTH_URL,
    getPayloadServerURL(),
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ];

  const origins = new Set<string>();

  for (const raw of candidates) {
    if (!raw?.trim()) continue;
    const base = raw.trim().replace(/\/$/, "");
    origins.add(base);
    if (base.startsWith("http://")) {
      origins.add(`https://${base.slice("http://".length)}`);
    } else if (base.startsWith("https://")) {
      origins.add(`http://${base.slice("https://".length)}`);
    }
  }

  return [...origins];
}
