import type { CollectionConfig } from "payload";

export const StandDiscussions: CollectionConfig = {
  slug: "stand-discussions",
  admin: {
    useAsTitle: "title",
    defaultColumns: ["title", "author", "status", "publishedAt", "updatedAt"],
    description: "Member discussions on The Stand — meetups, travel, squad debate.",
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
      name: "slug",
      type: "text",
      required: true,
      unique: true,
      index: true,
    },
    {
      name: "excerpt",
      type: "textarea",
      maxLength: 400,
    },
    {
      name: "body",
      type: "textarea",
      required: true,
      maxLength: 12000,
      admin: {
        description: "Opening post — rich editor on the site writer view (coming soon).",
      },
    },
    {
      name: "category",
      type: "select",
      defaultValue: "general",
      options: [
        { label: "Meetup", value: "meetup" },
        { label: "Travel", value: "travel" },
        { label: "Squad", value: "squad" },
        { label: "Match day", value: "match-day" },
        { label: "General", value: "general" },
      ],
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
      defaultValue: "draft",
      options: [
        { label: "Draft", value: "draft" },
        { label: "Published", value: "published" },
        { label: "Hidden", value: "hidden" },
      ],
    },
    {
      name: "publishedAt",
      type: "date",
      index: true,
    },
    {
      name: "pinned",
      type: "checkbox",
      defaultValue: false,
      admin: { description: "Pin to The Stand trending list" },
    },
  ],
};
