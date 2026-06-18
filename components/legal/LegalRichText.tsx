import { convertLexicalToHTML } from "@payloadcms/richtext-lexical/html";
import type { SerializedEditorState } from "lexical";

type LegalRichTextProps = {
  content: SerializedEditorState;
};

export function LegalRichText({ content }: LegalRichTextProps) {
  const html = convertLexicalToHTML({
    data: content,
    disableContainer: true,
  });

  return (
    <div
      className="legal-rich-text space-y-4 text-base leading-relaxed text-white/85 [&_a]:font-semibold [&_a]:text-emerald-glow [&_a]:hover:underline [&_h2]:font-display [&_h2]:text-sm [&_h2]:font-extrabold [&_h2]:uppercase [&_h2]:text-amber [&_li]:text-white/85 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-5 [&_p]:text-white/85 [&_strong]:font-semibold [&_strong]:text-white [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
