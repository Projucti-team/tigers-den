import type { Field, GlobalConfig } from "payload";

async function revalidateLegalPage(path: string) {
  const { revalidatePath } = await import("next/cache");
  revalidatePath(path);
}

export const legalPageFields: Field[] = [
  {
    name: "subtitle",
    type: "text",
    required: true,
    admin: {
      description: "Shown under the page title in the hero.",
    },
  },
  {
    name: "lastUpdated",
    type: "date",
    required: true,
    admin: {
      date: {
        pickerAppearance: "dayOnly",
      },
      description: "Displayed at the top of the page body.",
    },
  },
  {
    name: "content",
    type: "richText",
    required: true,
    admin: {
      description: "Use headings for sections (e.g. What we collect, Contact).",
    },
  },
];

export function legalGlobalConfig(args: {
  slug: string;
  label: string;
  path: string;
}): GlobalConfig {
  return {
    slug: args.slug,
    label: args.label,
    admin: {
      group: "Site",
    },
    access: {
      read: () => true,
      update: ({ req: { user } }) => Boolean(user),
    },
    hooks: {
      afterChange: [async () => revalidateLegalPage(args.path)],
    },
    fields: legalPageFields,
  };
}
