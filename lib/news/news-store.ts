import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import type { BangladeshCricketNewsSnapshot } from "@/lib/news/types";

export const BANGLADESH_CRICKET_NEWS_PATH = path.join(
  process.cwd(),
  "data",
  "bangladesh-cricket-news.json",
);

export async function readBangladeshCricketNews(): Promise<BangladeshCricketNewsSnapshot | null> {
  try {
    const raw = await readFile(BANGLADESH_CRICKET_NEWS_PATH, "utf8");
    const data = JSON.parse(raw) as BangladeshCricketNewsSnapshot;
    if (!Array.isArray(data?.items)) return null;
    return data;
  } catch {
    return null;
  }
}

export async function writeBangladeshCricketNews(
  snapshot: BangladeshCricketNewsSnapshot,
): Promise<void> {
  await mkdir(path.dirname(BANGLADESH_CRICKET_NEWS_PATH), { recursive: true });
  await writeFile(
    BANGLADESH_CRICKET_NEWS_PATH,
    `${JSON.stringify(snapshot, null, 2)}\n`,
    "utf8",
  );
}
