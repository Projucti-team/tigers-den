import Link from "next/link";
import type { ReactNode } from "react";

import { PageHero } from "@/components/pages/PageHero";

type LegalPageShellProps = {
  title: string;
  subtitle: string;
  lastUpdated: string;
  children: ReactNode;
};

export function LegalPageShell({ title, subtitle, lastUpdated, children }: LegalPageShellProps) {
  return (
    <>
      <PageHero label="Legal" title={title} subtitle={subtitle} />

      <div className="mx-auto max-w-3xl px-4 py-12 md:px-8">
        <p className="text-sm text-white/50">Last updated: {lastUpdated}</p>

        <section className="mt-8">{children}</section>

        <div className="mt-10">
          <Link href="/" className="fan-btn-green rounded px-6 py-3 text-sm">
            Back to home
          </Link>
        </div>
      </div>
    </>
  );
}
