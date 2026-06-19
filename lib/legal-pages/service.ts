import type { SerializedEditorState } from "lexical";

import { getPayloadClient } from "@/lib/payload";
import { isPayloadConfigured } from "@/lib/payload-env";

export type LegalPageSlug = "privacy-policy" | "terms-of-service";

export type LegalPageContent = {
  subtitle: string;
  lastUpdated: string;
  content: SerializedEditorState;
};

function hasLexicalContent(content: SerializedEditorState | undefined | null): boolean {
  const children = content?.root?.children;
  return Array.isArray(children) && children.length > 0;
}

function formatLegalDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export async function getLegalPage(slug: LegalPageSlug): Promise<LegalPageContent | null> {
  if (!isPayloadConfigured()) return null;

  try {
    const payload = await getPayloadClient();
    const doc =
      slug === "privacy-policy"
        ? await payload.findGlobal({ slug: "privacy-policy", depth: 0 })
        : await payload.findGlobal({ slug: "terms-of-service", depth: 0 });

    const page = doc as {
      subtitle?: string | null;
      lastUpdated?: string | null;
      content?: SerializedEditorState | null;
    };
    if (!page?.subtitle || !page.lastUpdated || !hasLexicalContent(page.content)) {
      return null;
    }

    return {
      subtitle: page.subtitle,
      lastUpdated: formatLegalDate(page.lastUpdated),
      content: page.content!,
    };
  } catch {
    return null;
  }
}
