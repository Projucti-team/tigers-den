import type { CollectionConfig } from "payload";

export const MemberFollows: CollectionConfig = {
  slug: "member-follows",
  admin: {
    useAsTitle: "id",
    defaultColumns: ["follower", "following", "createdAt"],
  },
  access: {
    read: () => true,
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  fields: [
    {
      name: "follower",
      type: "relationship",
      relationTo: "members",
      required: true,
      index: true,
    },
    {
      name: "following",
      type: "relationship",
      relationTo: "members",
      required: true,
      index: true,
    },
    {
      name: "createdAt",
      type: "date",
      required: true,
    },
  ],
};
