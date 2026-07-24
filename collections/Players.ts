import type { CollectionConfig } from "payload";

export const Players: CollectionConfig = {
  slug: "players",
  admin: {
    useAsTitle: "displayName",
    defaultColumns: ["displayName", "country", "photo", "cricinfoPlayerId", "iccPlayerId", "updatedAt"],
    description:
      "Cricket player identity cache — ESPN profile URL, ICC headshot, and external ids.",
    components: {
      beforeList: ["@/components/admin/PlayerMergePanel"],
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
      admin: {
        description:
          "Headshot URL actually shown on the site. Points at our own mirrored copy (see " +
          "Photo below) once one exists — never hot-links ESPN/ICC/CricAPI directly.",
      },
    },
    {
      name: "photo",
      type: "upload",
      relationTo: "media",
      admin: {
        description:
          "Our own copy of this player's headshot, mirrored automatically from ICC/Cricinfo/" +
          "CricAPI on first sync. Upload one manually here if auto-mirroring has nothing for " +
          "this player — once set, it's used as-is and never auto-replaced. Clear it to let " +
          "the next sync mirror a fresh copy from source.",
      },
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
    {
      name: "aliases",
      type: "array",
      admin: {
        description:
          "Alternate spellings that should resolve to this same player (e.g. \"Mohammad\" vs " +
          "\"Mohammed\"). Populated automatically when two records are merged in the admin " +
          "panel above — add one by hand if a source spells a name differently and sync keeps " +
          "creating a duplicate.",
      },
      fields: [{ name: "name", type: "text", required: true }],
    },
  ],
};
