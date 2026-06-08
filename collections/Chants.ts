import type { CollectionConfig } from "payload";

export const Chants: CollectionConfig = {
  slug: "chants",
  admin: {
    useAsTitle: "title",
    defaultColumns: ["title", "author", "status", "featuredAt", "updatedAt"],
    description: "Fan-submitted terrace chants — approve and feature Chant of the Week.",
  },
  access: {
    read: () => true,
    create: () => false,
    update: () => false,
    delete: ({ req }) => Boolean(req.user),
  },
  fields: [
    {
      name: "title",
      type: "text",
      required: true,
    },
    {
      name: "lyrics",
      type: "textarea",
      required: true,
      maxLength: 2000,
      admin: { description: "One line per row in the textarea; shown as separate lines on the site." },
    },
    {
      name: "author",
      type: "relationship",
      relationTo: "members",
      required: true,
      index: true,
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "pending",
      options: [
        { label: "Pending review", value: "pending" },
        { label: "Approved", value: "approved" },
        { label: "Featured (Chant of the Week)", value: "featured" },
        { label: "Rejected", value: "rejected" },
      ],
    },
    {
      name: "featuredAt",
      type: "date",
      admin: { description: "When this chant was featured on the homepage" },
    },
  ],
};
