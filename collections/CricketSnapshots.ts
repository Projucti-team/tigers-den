import type { CollectionConfig } from "payload";

/** Nightly cricket data (rankings, tours, squads, venues) — written by cron, read on page load. */
export const CricketSnapshots: CollectionConfig = {
  slug: "cricket-snapshots",
  admin: {
    useAsTitle: "key",
    defaultColumns: ["key", "label", "fetchedAt", "updatedAt"],
    description:
      "Pre-built cricket pages data. Refreshed nightly ~3:00 AM Bangladesh time via /api/cron/cricket.",
  },
  access: {
    read: () => true,
    create: () => false,
    update: () => false,
    delete: ({ req }) => Boolean(req.user),
  },
  fields: [
    {
      name: "key",
      type: "text",
      required: true,
      unique: true,
      index: true,
      admin: {
        description: "e.g. rankings-showcase, tours-index, tour-detail:slug",
      },
    },
    {
      name: "label",
      type: "text",
      required: true,
    },
    {
      name: "fetchedAt",
      type: "date",
      required: true,
    },
    {
      name: "data",
      type: "json",
      required: true,
    },
  ],
};
