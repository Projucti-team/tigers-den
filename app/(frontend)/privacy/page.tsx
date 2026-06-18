import { DefaultPrivacyContent } from "@/components/legal/DefaultPrivacyContent";
import { LegalPageShell } from "@/components/legal/LegalPageShell";
import { LegalRichText } from "@/components/legal/LegalRichText";
import { getLegalPage } from "@/lib/legal-pages/service";

export const metadata = {
  title: "Privacy Policy — The Tigers' Den",
  description: "How The Tigers' Den collects and uses your information.",
};

export const dynamic = "force-dynamic";

const DEFAULT_SUBTITLE = "A plain-language summary of how we handle your data on tigersden.bd.";
const DEFAULT_LAST_UPDATED = "13 June 2026";

export default async function PrivacyPage() {
  const cms = await getLegalPage("privacy-policy");

  return (
    <LegalPageShell
      title="Privacy Policy"
      subtitle={cms?.subtitle ?? DEFAULT_SUBTITLE}
      lastUpdated={cms?.lastUpdated ?? DEFAULT_LAST_UPDATED}
    >
      {cms ? <LegalRichText content={cms.content} /> : <DefaultPrivacyContent />}
    </LegalPageShell>
  );
}
