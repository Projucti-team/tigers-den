import type { CollectionConfig } from "payload";

export const StandComments: CollectionConfig = {
  slug: "stand-comments",
  admin: {
    useAsTitle: "id",
    defaultColumns: ["targetType", "targetId", "author", "createdAt"],
    description: "Comments on profile posts and stand discussions.",
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
      ],
    },
    {
      name: "targetId",
      type: "number",
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
      maxLength: 2000,
    },
    {
      name: "createdAt",
      type: "date",
      required: true,
      index: true,
    },
  ],
};
