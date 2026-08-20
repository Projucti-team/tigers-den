import type { CollectionConfig } from "payload";

/** Admin-managed domestic / franchise leagues where Bangladeshi players appear. */
export const TrackedPlayerLeagues: CollectionConfig = {
  slug: "tracked-player-leagues",
  admin: {
    useAsTitle: "playerCricinfoUrl",
    defaultColumns: ["playerName", "teamName", "leagueName", "active", "lastResolvedAt"],
    description:
      "Track Bangladeshi players in overseas leagues (e.g. Hasan Mahmud for Kent). Paste the player's " +
      "and team's ESPNcricinfo profile links — the sync job resolves the display names and current " +
      "competition automatically. Match Centre only shows a live/completed match when the tracked " +
      "player is actually named in that match's playing XI, not just whenever their team plays.",
    components: {
      beforeList: ["@/components/admin/TrackedPlayerLeaguesHelp"],
    },
  },
  access: {
    read: () => true,
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  fields: [
    {
      name: "playerCricinfoUrl",
      type: "text",
      required: true,
      admin: {
        description:
          "Player's ESPNcricinfo profile link, e.g. https://www.espncricinfo.com/cricketers/hasan-mahmud-926629",
      },
    },
    {
      name: "teamCricinfoUrl",
      type: "text",
      required: true,
      admin: {
        description:
          "Team's ESPNcricinfo profile link, e.g. https://www.espncricinfo.com/team/kent-1098",
      },
    },
    {
      name: "active",
      type: "checkbox",
      defaultValue: true,
      admin: { description: "Uncheck when the player leaves the league or the season ends." },
    },
    // Everything below is resolved automatically by the sync job — not admin-entered.
    {
      name: "playerName",
      type: "text",
      admin: { readOnly: true, description: "Resolved from the player link." },
    },
    {
      name: "teamName",
      type: "text",
      admin: { readOnly: true, description: "Resolved from the team link." },
    },
    {
      name: "leagueName",
      type: "text",
      admin: { readOnly: true, description: "Resolved current/default competition for the team." },
    },
    {
      name: "athleteId",
      type: "number",
      admin: { readOnly: true, description: "ESPN Core athlete id, parsed from the player link." },
    },
    {
      name: "teamId",
      type: "number",
      admin: { readOnly: true, description: "ESPN Core team id, parsed from the team link." },
    },
    {
      name: "espnLeagueId",
      type: "number",
      admin: { readOnly: true, description: "Resolved ESPN Core league id currently being scanned." },
    },
    {
      name: "lastResolvedAt",
      type: "date",
      admin: { readOnly: true, description: "When the sync job last resolved this entry." },
    },
  ],
};
