export type NewsSource = "espncricinfo" | "cricbuzz";

export type CricketNewsItem = {
  id: string;
  title: string;
  summary?: string;
  url: string;
  imageUrl?: string;
  source: NewsSource;
  publishedAt: string;
};

export type BangladeshCricketNewsSnapshot = {
  fetchedAt: string;
  items: CricketNewsItem[];
};
