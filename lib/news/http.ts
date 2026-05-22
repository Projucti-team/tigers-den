const DEFAULT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (compatible; TigersDen/1.0; +https://github.com/tigersden)",
  Accept: "text/html,application/xml,application/xhtml+xml",
};

export type FetchTextOptions = RequestInit & {
  /** Next.js ISR cache seconds (omit for scrape scripts). */
  revalidate?: number;
};

export async function fetchText(url: string, init?: FetchTextOptions): Promise<string> {
  const { revalidate, ...rest } = init ?? {};
  const res = await fetch(url, {
    ...rest,
    headers: { ...DEFAULT_HEADERS, ...rest?.headers },
    ...(revalidate !== undefined ? { next: { revalidate } } : {}),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
