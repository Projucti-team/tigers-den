import type { HeroSlide, Media, Post } from "@/payload-types";

export const mockMatch = {
  title: "Bangladesh vs England — 2nd ODI (Mirpur)",
  isLive: true,
  score: "274/5",
  overs: "44.2 ov",
  crr: "6.18",
  batsmen: [
    { name: "Litton Das", score: "92*", balls: "88b", fours: 8, sixes: 3 },
    { name: "Mahmudullah", score: "14", balls: "12b", fours: 1, sixes: 0 },
  ],
  bowlers: [
    { name: "Mark Wood", figures: "8.2-0-54-2" },
    { name: "Jofra Archer", figures: "9-1-48-1" },
  ],
  lastSix: ["4", "1", "Wd", "6", "0", "1"],
  poll: [
    { name: "Litton Das", percent: 78 },
    { name: "Mahmudullah", percent: 22 },
  ],
};

export const mockThreads = [
  {
    id: "1",
    pinned: true,
    title: "Official London Meetup Thread - Lord's Test 2026",
    author: "TaskinFanatic",
    replies: 142,
    ago: "12 mins ago",
  },
  {
    id: "2",
    pinned: false,
    title: "Best places to grab authentic food near the stadium in Antigua?",
    author: "TravelTiger",
    replies: 64,
    ago: "1 hour ago",
  },
  {
    id: "3",
    pinned: false,
    title: "Predicting the 15-man squad for the upcoming T20 Series",
    author: "StatMaster_BD",
    replies: 289,
    ago: "3 hours ago",
    hot: true,
  },
];

export const mockChat = [
  { user: "Fahim_99", message: "Litton is absolutely flaying them over extra cover!" },
  {
    user: "RedGreenArmy",
    message: "Can we cross 320 from here??",
  },
];

export const mockChant = {
  title: "The Mirpur Express",
  lines: [
    "He runs in from the boundary line,",
    "Shaking up the opposition spine...",
  ],
};

export const mockTours = [
  {
    title: "The Caribbean Raid 2026",
    description: "Full Test & ODI Travel Pack",
    emoji: "🌴",
  },
  {
    title: "The UK Summer Assault",
    description: "Lord's & The Oval Fan Packages",
    emoji: "👑",
  },
  {
    title: "Home Fortress Mirpur",
    description: "Matchday Tickets & Hotel Stays",
    emoji: "🏏",
  },
];

export { getAbsoluteMediaUrl as getMediaUrl } from "@/lib/media";

export function formatThreadFromPost(post: Post) {
  return {
    id: String(post.id),
    pinned: post.pinned ?? false,
    title: post.title,
    author: "Editorial",
    replies: 0,
    ago: post.publishedAt
      ? new Date(post.publishedAt).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
        })
      : "Recently",
    hot: false,
  };
}

export function isSlideVisible(slide: HeroSlide, now = new Date()) {
  if (slide.isActive === false) return false;
  if (slide.visibleFrom && new Date(slide.visibleFrom) > now) return false;
  if (slide.visibleUntil && new Date(slide.visibleUntil) < now) return false;
  return true;
}
