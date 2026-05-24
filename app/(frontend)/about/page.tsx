import Link from "next/link";

import { PageHero } from "@/components/pages/PageHero";
import { aboutCopy, socialLinks } from "@/lib/site-content";

export const metadata = {
  title: "About — The Tigers' Den",
  description: "Who we are — developers and die-hard Bangladesh cricket fans building The Tigers' Den.",
};

export default function AboutPage() {
  return (
    <>
      <PageHero label="About us" title="The Tigers' Den" subtitle={aboutCopy.headline} />

      <div className="mx-auto max-w-3xl px-4 py-12 md:px-8">
        <p className="text-base leading-relaxed text-charcoal/80">{aboutCopy.intro}</p>
        <p className="mt-4 text-base leading-relaxed text-charcoal/80">{aboutCopy.body}</p>
        <p className="mt-6 font-display text-lg font-extrabold text-emerald">{aboutCopy.signoff}</p>

        <section className="mt-10 rounded-lg border-4 border-emerald bg-white p-6 shadow-lg">
          <h2 className="font-display text-sm font-extrabold uppercase text-crimson">Follow us</h2>
          <ul className="mt-4 flex flex-wrap gap-3">
            {socialLinks.map((link) => (
              <li key={link.label}>
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="fan-btn-green rounded px-4 py-2 text-xs"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-charcoal/55">
            Replace these links with your official channels when ready.
          </p>
        </section>

        <div className="mt-10 flex flex-wrap gap-4">
          <Link href="/join" className="fan-btn-red rounded px-6 py-3 text-sm">
            Join the Den
          </Link>
          <Link href="/" className="rounded border-2 border-emerald px-6 py-3 text-sm font-bold uppercase text-emerald hover:bg-emerald/5">
            Back to home
          </Link>
        </div>
      </div>
    </>
  );
}
