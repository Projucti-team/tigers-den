import type { CollectionConfig } from "payload";

export const Users: CollectionConfig = {
  slug: "users",
  auth: {
    cookies: {
      secure:
        process.env.COOKIE_SECURE === "true"
          ? true
          : process.env.COOKIE_SECURE === "false"
            ? false
            : process.env.NODE_ENV === "production",
      sameSite: "Lax",
    },
  },
  admin: {
    useAsTitle: "email",
  },
  fields: [
    {
      name: "name",
      type: "text",
    },
    {
      name: "role",
      type: "select",
      required: true,
      defaultValue: "editor",
      options: [
        { label: "Super Admin", value: "admin" },
        { label: "Editor", value: "editor" },
        { label: "Moderator", value: "moderator" },
      ],
    },
  ],
};
