import type { CollectionConfig } from "payload";

async function revalidateHomeHero() {
  const { revalidatePath } = await import("next/cache");
  revalidatePath("/");
}

export const Media: CollectionConfig = {
  slug: "media",
  hooks: {
    afterChange: [revalidateHomeHero],
    afterDelete: [revalidateHomeHero],
  },
  access: {
    read: () => true,
    create: ({ req: { user } }) => Boolean(user),
    update: ({ req: { user } }) => Boolean(user),
    delete: ({ req: { user } }) => Boolean(user),
  },
  upload: {
    staticDir: "media",
    imageSizes: [
      {
        name: "thumbnail",
        width: 400,
        height: 300,
        position: "centre",
      },
      {
        name: "hero",
        width: 1920,
        height: 800,
        position: "centre",
      },
    ],
    adminThumbnail: "thumbnail",
    mimeTypes: ["image/*"],
  },
  fields: [
    {
      name: "alt",
      type: "text",
      required: true,
    },
  ],
};
