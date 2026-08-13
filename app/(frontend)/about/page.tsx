import Link from "next/link";

import { PageHero } from "@/components/pages/PageHero";
import { aboutCopy, socialLinks } from "@/lib/site-content";
import { ComingSoonBadge } from "@/components/ui/ComingSoonBadge";

export const metadata = {
  title: "About — The Tigers' Den",
  description: "Who we are — developers and die-hard Bangladesh cricket fans building The Tigers' Den.",
};

export default function AboutPage() {
  return (
    <>
      <PageHero label="About us" title="The Tigers' Den" subtitle={aboutCopy.headline} />

      <div className="mx-auto max-w-3xl px-4 py-12 md:px-8">
        <p className="text-base leading-relaxed text-white/85">{aboutCopy.intro}</p>
        <p className="mt-4 text-base leading-relaxed text-white/85">{aboutCopy.body}</p>
        <p className="mt-6 font-display text-lg font-extrabold text-emerald-glow">{aboutCopy.signoff}</p>

        <section className="mt-10 rounded-lg border-4 border-emerald bg-white p-6 shadow-lg">
          <h2 className="font-display text-sm font-extrabold uppercase text-crimson">Follow us</h2>
          <ul className="mt-4 flex flex-wrap gap-3">
            {socialLinks.map((link) => (
              <li key={link.label}>
                {link.comingSoon ? (
                  <span
                    className="inline-flex cursor-default items-center gap-1.5 rounded border-2 border-charcoal/15 px-4 py-2 text-xs font-bold uppercase tracking-wide text-charcoal/40"
                    aria-disabled="true"
                  >
                    {link.label}
                    <ComingSoonBadge compact />
                  </span>
                ) : (
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="fan-btn-green rounded px-4 py-2 text-xs"
                  >
                    {link.label}
                  </a>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-charcoal/55">
            More channels launching soon — follow us on Facebook for now.
          </p>
        </section>

        <div className="mt-10 flex flex-wrap gap-4">
          <Link href="/join" className="fan-btn-red rounded px-6 py-3 text-sm">
            Join the Den
          </Link>
          <Link href="/" className="rounded border-2 border-emerald-glow/50 px-6 py-3 text-sm font-bold uppercase text-white hover:bg-emerald/20">
            Back to home
          </Link>
        </div>
      </div>
    </>
  );
}
