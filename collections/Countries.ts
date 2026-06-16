import type { CollectionConfig } from "payload";

export const Countries: CollectionConfig = {
  slug: "countries",
  admin: {
    useAsTitle: "name",
    defaultColumns: ["name", "slug", "espnTeamId", "updatedAt"],
    description: "Cricket nations — used to group players and resolve ESPN roster lookups.",
  },
  access: {
    read: () => true,
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  fields: [
    {
      name: "slug",
      type: "text",
      required: true,
      unique: true,
      index: true,
      admin: { description: "Stable key, e.g. bangladesh, australia." },
    },
    {
      name: "name",
      type: "text",
      required: true,
    },
    {
      name: "shortName",
      type: "text",
      admin: { description: "Abbreviation shown in UI, e.g. BAN, AUS." },
    },
    {
      name: "espnTeamId",
      type: "number",
      admin: { description: "ESPN Core team id for roster lookups." },
    },
    {
      name: "iccTeamName",
      type: "text",
      admin: { description: "Label used in ICC rankings feed, e.g. Bangladesh." },
    },
  ],
};
