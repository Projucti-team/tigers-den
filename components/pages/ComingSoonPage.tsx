import Link from "next/link";

import { ThirdUmpirePending } from "@/components/pages/ThirdUmpirePending";
import { PageHero } from "@/components/pages/PageHero";

type ComingSoonPageProps = {
  title: string;
  subtitle?: string;
  /** Third-umpire “Decision Pending” broadcast animation (Shop & Tickets). */
  thirdUmpireAnimation?: boolean;
};

export function ComingSoonPage({
  title,
  subtitle = "We are building something special for the Tigers' Den army. Check back soon.",
  thirdUmpireAnimation = false,
}: ComingSoonPageProps) {
  return (
    <>
      <PageHero label="Coming soon" title={title} subtitle={subtitle} />
      <div className="mx-auto max-w-lg px-4 py-10 md:px-8 md:py-14">
        {thirdUmpireAnimation ? (
          <ThirdUmpirePending />
        ) : (
          <p className="text-center text-base leading-relaxed text-white/75">
            We are building something special for the Tigers&apos; Den army. Check back soon.
          </p>
        )}

        <p className={`text-center text-sm leading-relaxed text-white/70 ${thirdUmpireAnimation ? "mt-10" : "mt-8"}`}>
          Want updates first?{" "}
          <Link href="/join" className="font-semibold text-emerald-glow hover:text-amber hover:underline">
            Become a member
          </Link>{" "}
          and we will let you know when this goes live.
        </p>
        <div className="mt-8 text-center">
          <Link href="/" className="fan-btn-green inline-block rounded px-8 py-3 text-sm">
            Back to home
          </Link>
        </div>
      </div>
    </>
  );
}
