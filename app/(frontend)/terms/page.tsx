import { DefaultTermsContent } from "@/components/legal/DefaultTermsContent";
import { LegalPageShell } from "@/components/legal/LegalPageShell";
import { LegalRichText } from "@/components/legal/LegalRichText";
import { getLegalPage } from "@/lib/legal-pages/service";

export const metadata = {
  title: "Terms of Service — The Tigers' Den",
  description: "Terms and conditions for using tigersden.bd.",
};

export const dynamic = "force-dynamic";

const DEFAULT_SUBTITLE =
  "The rules for using tigersden.bd as a member of The Tigers' Den fan community.";
const DEFAULT_LAST_UPDATED = "13 June 2026";

export default async function TermsPage() {
  const cms = await getLegalPage("terms-of-service");

  return (
    <LegalPageShell
      title="Terms of Service"
      subtitle={cms?.subtitle ?? DEFAULT_SUBTITLE}
      lastUpdated={cms?.lastUpdated ?? DEFAULT_LAST_UPDATED}
    >
      {cms ? <LegalRichText content={cms.content} /> : <DefaultTermsContent />}
    </LegalPageShell>
  );
}
