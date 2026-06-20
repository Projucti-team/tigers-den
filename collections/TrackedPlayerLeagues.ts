import type { CollectionConfig } from "payload";

/** Admin-managed domestic / franchise leagues where Bangladeshi players appear. */
export const TrackedPlayerLeagues: CollectionConfig = {
  slug: "tracked-player-leagues",
  admin: {
    useAsTitle: "playerName",
    defaultColumns: ["playerName", "teamName", "leagueName", "espnLeagueId", "active"],
    description:
      "Track Bangladeshi players in overseas leagues (e.g. Hasan Mahmud for Kent in County Championship). " +
      "Match Centre shows live scores when their team is playing, with a banner above the score.",
  },
  access: {
    read: () => true,
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  fields: [
    {
      name: "playerName",
      type: "text",
      required: true,
      admin: { description: "Player display name, e.g. Hasan Mahmud." },
    },
    {
      name: "teamName",
      type: "text",
      required: true,
      admin: { description: "Franchise / county side, e.g. Kent." },
    },
    {
      name: "leagueName",
      type: "text",
      required: true,
      admin: { description: "Competition label shown in Match Centre, e.g. County Championship." },
    },
    {
      name: "espnLeagueId",
      type: "number",
      required: true,
      admin: {
        description:
          "ESPN Core league id (same as cricinfo series id on the series URL). Required for live scores.",
      },
    },
    {
      name: "cricinfoSeriesId",
      type: "number",
      admin: { description: "Optional cricinfo series id if different from ESPN league id." },
    },
    {
      name: "seasonYear",
      type: "number",
      admin: {
        description: "Season year for tournament fixtures (e.g. 2026). Uses season events API when set.",
      },
    },
    {
      name: "useSeasonEvents",
      type: "checkbox",
      defaultValue: true,
      admin: {
        description: "Scan /seasons/{year}/events for full fixture lists (needed for World Cups and long leagues).",
      },
    },
    {
      name: "active",
      type: "checkbox",
      defaultValue: true,
      admin: { description: "Uncheck when the player leaves the league or the season ends." },
    },
  ],
};
