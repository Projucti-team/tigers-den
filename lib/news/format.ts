import type { CricketNewsItem } from "@/lib/news/types";

export const NEWS_SOURCE_LABELS: Record<CricketNewsItem["source"], string> = {
  espncricinfo: "ESPN Cricinfo",
  cricbuzz: "Cricbuzz",
  bdnews24: "bdnews24",
  dailystar: "The Daily Star",
};

export function formatNewsRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
