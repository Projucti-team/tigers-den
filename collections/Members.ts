import type { CollectionConfig } from "payload";

export const Members: CollectionConfig = {
  slug: "members",
  admin: {
    useAsTitle: "email",
    defaultColumns: ["username", "name", "email", "country", "joinedAt"],
    description: "Fan members who joined via Google or Facebook.",
  },
  access: {
    read: ({ req }) => Boolean(req.user),
    create: () => false,
    update: () => false,
    delete: ({ req }) => Boolean(req.user),
  },
  fields: [
    {
      name: "email",
      type: "email",
      required: true,
      unique: true,
      index: true,
    },
    {
      name: "username",
      type: "text",
      required: true,
      unique: true,
      index: true,
      admin: { description: "Public profile URL: /profile/{username}" },
    },
    {
      name: "name",
      type: "text",
      required: true,
    },
    {
      name: "bio",
      type: "textarea",
      maxLength: 280,
    },
    {
      name: "provider",
      type: "select",
      required: true,
      options: [
        { label: "Google", value: "google" },
        { label: "Facebook", value: "facebook" },
      ],
    },
    {
      name: "providerAccountId",
      type: "text",
      admin: { description: "OAuth account id from the provider." },
    },
    {
      name: "avatar",
      type: "upload",
      relationTo: "media",
      admin: { description: "Member-uploaded profile photo." },
    },
    {
      name: "imageUrl",
      type: "text",
      admin: { description: "OAuth provider photo URL (not shown on site)." },
    },
    {
      name: "country",
      type: "text",
      admin: { description: "Country where the member currently lives (optional)." },
    },
    {
      name: "favoritePlayer",
      type: "text",
      admin: { description: "Favourite Bangladesh player (optional)." },
    },
    {
      name: "joinedAt",
      type: "date",
      required: true,
    },
  ],
};
