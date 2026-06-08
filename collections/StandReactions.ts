import type { CollectionConfig } from "payload";

import { REACTION_OPTIONS } from "@/lib/stand/engagement-types";

export const StandReactions: CollectionConfig = {
  slug: "stand-reactions",
  admin: {
    useAsTitle: "id",
    defaultColumns: ["targetType", "targetId", "member", "reaction", "createdAt"],
    description: "Fan reactions on posts, discussions, and chants.",
  },
  access: {
    read: () => true,
    create: () => false,
    update: () => false,
    delete: ({ req }) => Boolean(req.user),
  },
  fields: [
    {
      name: "targetType",
      type: "select",
      required: true,
      index: true,
      options: [
        { label: "Profile post", value: "member-post" },
        { label: "Discussion", value: "stand-discussion" },
        { label: "Chant", value: "chant" },
      ],
    },
    {
      name: "targetId",
      type: "number",
      required: true,
      index: true,
    },
    {
      name: "member",
      type: "relationship",
      relationTo: "members",
      required: true,
      index: true,
    },
    {
      name: "reaction",
      type: "select",
      required: true,
      options: REACTION_OPTIONS.map((r) => ({ label: `${r.emoji} ${r.label}`, value: r.id })),
    },
    {
      name: "createdAt",
      type: "date",
      required: true,
      index: true,
    },
  ],
};
