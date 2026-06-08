export type ProfileTabGuide = {
  id: string;
  title: string;
  tagline: string;
  description: string;
  useFor: string[];
  notFor?: string;
  examples: { label: string; text: string }[];
  ctaLabel?: string;
  ctaHref?: string;
};

export const PROFILE_DISCUSSIONS_GUIDE: ProfileTabGuide = {
  id: "discussions",
  title: "Discussions",
  tagline: "Talk with the Den — not just at them.",
  description:
    "Start a thread when you want a conversation: meetup plans, travel advice, squad picks, or match-day logistics. Discussions live on The Stand where other fans can read, comment, and react (🐯 ❤️ 🔥 👏 💯).",
  useFor: [
    "Organising away-day or stadium meetups",
    "Asking for travel, hotel, or food tips near a ground",
    "Debating the XI, tactics, or a controversial decision",
    "Sharing match-day plans others can join",
  ],
  notFor:
    "Quick photo updates or one-liners — use Posts for those. Discussions are for topics that deserve replies.",
  examples: [
    {
      label: "Meetup",
      text: "Official London meetup — Lord's Test, July 2026. Who's in?",
    },
    {
      label: "Travel",
      text: "Best halal food within walking distance of Mirpur?",
    },
    {
      label: "Squad",
      text: "Would you pick Rishad for the third ODI — why or why not?",
    },
  ],
  ctaLabel: "Browse The Stand",
  ctaHref: "/the-stand",
};

export const PROFILE_CHANTS_GUIDE: ProfileTabGuide = {
  id: "chants",
  title: "Raise a chant",
  tagline: "Give the terrace its voice.",
  description:
    "Submit original terrace chants for Bangladesh — lyrics the crowd can sing. Other fans can react to approved chants; one is featured each week as Chant of the Week on the homepage.",
  useFor: [
    "Original lyrics for players, the team, or a moment",
    "Call-and-response lines the whole stand can pick up",
    "Rhythmic, short phrases that work when shouted together",
    "Bangla or English — or a mix, if it scans",
  ],
  notFor:
    "Abusive, offensive, or targeted abuse at players or officials. Keep it passionate, not personal.",
  examples: [
    {
      label: "Player",
      text: "He runs in from the boundary line, / Shaking up the opposition spine…",
    },
    {
      label: "Team",
      text: "Green and red, we never fade — / Tigers' Den in every parade!",
    },
    {
      label: "Moment",
      text: "Mirpur roars, the night is ours — / Taskin strikes, the crowd devours!",
    },
  ],
  ctaLabel: "Hear Chant of the Week",
  ctaHref: "/#chants",
};

export const PROFILE_POSTS_GUIDE: ProfileTabGuide = {
  id: "posts",
  title: "Posts",
  tagline: "Your match-day moments.",
  description:
    "Share photos, reactions, and short updates on your profile — like a fan scrapbook. Followers see these in their Feed.",
  useFor: [
    "Match-day photos from the ground or the sofa",
    "Quick reactions after a wicket or a win",
    "Celebrating a player without needing a long thread",
  ],
  examples: [],
};
