/** Dedicated membership / sign-in page */
export const JOIN_PAGE_PATH = "/join";

/** Member profile & social hub */
export const PROFILE_PAGE_PATH = "/profile";

export function profilePath(username: string): string {
  return `${PROFILE_PAGE_PATH}/${encodeURIComponent(username)}`;
}

export const experiences = [
  {
    id: "tours",
    title: "West Indies Tour 2026",
    subtitle:
      "Experience one of the best cricket tour destinations with spine-tingling moments — travel with The Tigers' Den.",
    cta: "Visit Tour Page",
    href: "#tours",
    accent: "green" as const,
    emoji: "🌴",
  },
  {
    id: "tickets",
    title: "Match Tickets",
    subtitle:
      "Members get priority access to Bangladesh home internationals at Mirpur, Chattogram & Sylhet.",
    cta: "Buy Tickets",
    href: "#tickets",
    accent: "red" as const,
    emoji: "🎟️",
  },
  {
    id: "match",
    title: "Match Centre",
    subtitle:
      "Live scores, ball-by-ball, fan polls and The Roar chat — follow every run in real time.",
    cta: "Go Live",
    href: "/match-centre",
    accent: "green" as const,
    emoji: "🏏",
  },
];

export const membershipTiers = [
  {
    name: "Adult Membership",
    price: "৳1,500",
    period: "per year",
    description:
      "Fantastic value for Bangladesh cricket fans wanting to join the most passionate, fun-loving supporters club.",
    features: [
      "Priority ticket access for home internationals",
      "Member rewards & partner discounts",
      "Exclusive meetups and watchalongs",
      "Access to tour booking windows",
    ],
    cta: "Join Now",
    highlight: false,
  },
  {
    name: "Lifetime Membership",
    price: "৳15,000",
    period: "one-off",
    description:
      "Say goodbye to renewals — lifetime membership of The Tigers' Den with every benefit, forever.",
    features: [
      "All Adult membership benefits for life",
      "Exclusive lifetime member badge",
      "First access to overseas tour packages",
      "Invites to annual Tigers' Den gala",
    ],
    cta: "Join Now",
    highlight: true,
  },
  {
    name: "Junior Membership",
    price: "৳800",
    period: "per year",
    description:
      "Inspire the next generation of Bangladesh supporters — junior shirt, stickers and family ticket priority.",
    features: [
      "Tigers' Den Juniors shirt & bat sticker",
      "Junior + one adult priority ticket access",
      "Member rewards for young fans",
      "Junior stand meetups on match days",
    ],
    cta: "Join Now",
    highlight: false,
  },
];

export const whyJoin = [
  {
    title: "Best value travel & accommodation",
    body: "We organise flights, hotels, transfers, match tickets and events. Sit back and enjoy the ultimate bucket-list tour with fellow fans.",
  },
  {
    title: "We are the experience experts",
    body: "Not just another travel agency — we've been taking Bangladesh fans around the world for years with world-class community and tour managers on every trip.",
  },
  {
    title: "The ultimate sporting bucket list",
    body: "From Mirpur to Lord's, from the Caribbean to the World Cup — tick off unforgettable experiences. First tour or hundredth cap, you're welcome in our den.",
  },
];

export const merchCategories = [
  { name: "Clothing", emoji: "👕", href: "/shop" },
  { name: "Accessories", emoji: "🧢", href: "/shop" },
  { name: "Headwear", emoji: "🎩", href: "/shop" },
  { name: "On Tour Range", emoji: "✈️", href: "/shop" },
];

export type NavLink = { label: string; href: string };

export type NavItem =
  | NavLink
  | {
    label: string;
    href: string;
    children: NavLink[];
  };

/** Nav links after Tours (Tours row is built with live series in the layout). */
export const navItemsAfterTours: NavLink[] = [
  { label: "Rankings", href: "/rankings" },
  { label: "Match Centre", href: "/match-centre" },
  { label: "News", href: "/chants" },
  { label: "The Stand", href: "/the-stand" },
  { label: "Tickets", href: "/tickets" },
  { label: "Shop", href: "/shop" },
  { label: "About", href: "/about" },
];

export function buildMainNav(tourChildren: NavLink[]): NavItem[] {
  return [
    {
      label: "Tours",
      href: "/tours",
      children: tourChildren.length
        ? tourChildren
        : [{ label: "All upcoming series", href: "/tours" }],
    },
    ...navItemsAfterTours,
  ];
}

export const socialLinks = [
  { label: "Facebook", href: "https://facebook.com" },
  { label: "X (Twitter)", href: "https://x.com" },
  { label: "Instagram", href: "https://instagram.com" },
  { label: "YouTube", href: "https://youtube.com" },
] as const;

export const aboutCopy = {
  headline: "Built by fans. Powered by code. Roaring for Bangladesh.",
  intro:
    "We are a small team of developers who are absolutely crazy about Bangladesh cricket — the green and red, the Mirpur roar, the away-day chants, and every nail-biting finish in between.",
  body: "The Tigers' Den is our love letter to the fan army: live scores, rankings, tour guides, and a community hub where supporters connect. We build in public, ship often, and listen to what real fans need on match day.",
  signoff: "TIGERS ROAR! 🐯 — see you in the stands (or in the chat).",
};
