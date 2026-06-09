import type { CollectionConfig } from "payload";

export const MatchChatMessages: CollectionConfig = {
  slug: "match-chat-messages",
  admin: {
    useAsTitle: "id",
    defaultColumns: ["matchId", "author", "createdAt"],
    description: "The Roar — live match chat messages.",
  },
  access: {
    read: () => true,
    create: () => false,
    update: () => false,
    delete: ({ req }) => Boolean(req.user),
  },
  fields: [
    {
      name: "matchId",
      type: "text",
      required: true,
      index: true,
    },
    {
      name: "author",
      type: "relationship",
      relationTo: "members",
      required: true,
      index: true,
    },
    {
      name: "body",
      type: "textarea",
      required: true,
      maxLength: 500,
    },
    {
      name: "createdAt",
      type: "date",
      required: true,
      index: true,
    },
  ],
};
