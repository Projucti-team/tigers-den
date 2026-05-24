import Link from "next/link";

import { PageHero } from "@/components/pages/PageHero";

type ComingSoonPageProps = {
  title: string;
  subtitle?: string;
};

export function ComingSoonPage({
  title,
  subtitle = "We are building something special for the Tigers' Den army. Check back soon.",
}: ComingSoonPageProps) {
  return (
    <>
      <PageHero label="Coming soon" title={title} subtitle={subtitle} />
      <div className="mx-auto max-w-lg px-4 py-16 text-center md:px-8">
        <p className="text-sm leading-relaxed text-charcoal/70">
          Want updates first?{" "}
          <Link href="/join" className="font-semibold text-emerald hover:text-crimson">
            Become a member
          </Link>{" "}
          and we will let you know when this goes live.
        </p>
        <Link href="/" className="fan-btn-green mt-8 inline-block rounded px-8 py-3 text-sm">
          Back to home
        </Link>
      </div>
    </>
  );
}
