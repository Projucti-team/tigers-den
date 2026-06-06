export type NewsSource = "espncricinfo" | "cricbuzz" | "bdnews24" | "dailystar";

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
