import type { CollectionConfig } from "payload";

export const MatchChatRooms: CollectionConfig = {
  slug: "match-chat-rooms",
  admin: {
    useAsTitle: "matchId",
    defaultColumns: ["matchId", "title", "endedAt", "updatedAt"],
    description: "One chat room per match — endedAt starts the 30-minute post-match window.",
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
      unique: true,
      index: true,
      admin: { description: "e.g. espn-1532480 or CricAPI match id" },
    },
    {
      name: "title",
      type: "text",
      required: true,
    },
    {
      name: "endedAt",
      type: "date",
      admin: {
        description: "When the match finished — chat input closes 30 minutes after this.",
      },
    },
  ],
};
