import type { CollectionConfig } from "payload";

export const MemberPosts: CollectionConfig = {
  slug: "member-posts",
  admin: {
    useAsTitle: "id",
    defaultColumns: ["author", "createdAt"],
    description: "Posts created by fan members on their profiles.",
  },
  access: {
    read: () => true,
    create: () => false,
    update: () => false,
    delete: ({ req }) => Boolean(req.user),
  },
  fields: [
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
      name: "images",
      type: "relationship",
      relationTo: "media",
      hasMany: true,
    },
    {
      name: "createdAt",
      type: "date",
      required: true,
      index: true,
    },
  ],
};
