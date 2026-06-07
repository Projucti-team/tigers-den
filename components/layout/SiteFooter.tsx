import Link from "next/link";

import { socialLinks } from "@/lib/site-content";

const quickLinks = [
  { label: "About", href: "/about" },
  { label: "Tours", href: "/tours" },
  { label: "Rankings", href: "/rankings" },
  { label: "Match Centre", href: "/match-centre" },
  { label: "News", href: "/chants" },
  { label: "Shop", href: "/shop" },
];

export function SiteFooter() {
  return (
    <footer className="mt-0 border-t-4 border-emerald bg-charcoal text-white">
      <div className="fan-gradient-bar h-1" aria-hidden />

      <div className="mx-auto grid max-w-[1440px] gap-10 px-4 py-12 md:grid-cols-3 md:px-8">
        <div>
          <p className="font-display text-xl font-extrabold uppercase text-emerald-glow">
            The Tigers&apos; Den
          </p>
          <p className="mt-3 text-sm leading-relaxed text-white/75">
            We are not just another supporters club — we are Bangladesh&apos;s fan army, bringing
            passionate, fun-loving fans together at home and abroad for over a generation of roars.
          </p>
          <div className="mt-4 flex flex-wrap gap-3 text-sm font-bold">
            {socialLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-amber"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>

        <div>
          <p className="font-display text-sm font-extrabold uppercase text-crimson-glow">
            Contact Us
          </p>
          <p className="mt-3 text-sm text-white/75">
            Mon–Fri: 9am – 5pm (BST)
            <br />
            Weekends: Closed
          </p>
          <p className="mt-2 text-sm">
            <a href="mailto:contacttigersden@gmail.com" className="font-semibold text-amber hover:underline">
              contacttigersden@gmail.com
            </a>
          </p>
        </div>

        <div>
          <p className="font-display text-sm font-extrabold uppercase text-emerald-glow">
            Quick Links
          </p>
          <ul className="mt-3 grid grid-cols-2 gap-2 text-sm">
            {quickLinks.map((link) => (
              <li key={link.label}>
                <Link href={link.href} className="text-white/75 hover:text-white hover:underline">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10 bg-pitch px-4 py-4 text-center text-xs text-white/50 md:px-8">
        <p>
          © 2026 The Tigers&apos; Den ·{" "}
          <Link href="/privacy" className="hover:text-white/80 hover:underline">
            Privacy
          </Link>{" "}
          · Terms · Code of Conduct · Cookie Policy
        </p>
        <p className="mt-1">
          <Link href="/admin" className="hover:text-white/80">
            Admin
          </Link>
        </p>
      </div>
    </footer>
  );
}
