import type { CollectionConfig } from "payload";

export const Players: CollectionConfig = {
  slug: "players",
  admin: {
    useAsTitle: "displayName",
    defaultColumns: ["displayName", "country", "cricinfoPlayerId", "iccPlayerId", "updatedAt"],
    description:
      "Cricket player identity cache — ESPN profile URL, ICC headshot, and external ids.",
  },
  access: {
    read: () => true,
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  fields: [
    {
      name: "lookupKey",
      type: "text",
      required: true,
      unique: true,
      index: true,
      admin: {
        readOnly: true,
        description: "countrySlug:normalized-name — built automatically.",
      },
    },
    {
      name: "displayName",
      type: "text",
      required: true,
      index: true,
    },
    {
      name: "country",
      type: "relationship",
      relationTo: "countries",
      required: true,
      index: true,
    },
    {
      name: "profileUrl",
      type: "text",
      admin: { description: "Canonical ESPN Cricinfo player profile URL." },
    },
    {
      name: "imageUrl",
      type: "text",
      admin: { description: "Verified ICC or Cricinfo headshot URL." },
    },
    {
      name: "iccPlayerId",
      type: "number",
      index: true,
      admin: { description: "ICC player id from rankings feed." },
    },
    {
      name: "cricinfoPlayerId",
      type: "number",
      index: true,
      admin: { description: "ESPN Cricinfo numeric player id." },
    },
    {
      name: "lastResolvedAt",
      type: "date",
      admin: { description: "When profile/image URLs were last verified." },
    },
  ],
};
