"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useState } from "react";

import { JOIN_PAGE_PATH, buildMainNav, type NavLink } from "@/lib/site-content";
import { ComingSoonBadge } from "@/components/ui/ComingSoonBadge";
import { useLiveMatchStatus } from "@/lib/hooks/useLiveMatchStatus";

type NavbarProps = {
  tourLinks: NavLink[];
  initialIsLive?: boolean;
};

function NavLinkLabel({ item }: { item: NavLink }) {
  return (
    <>
      {item.label}
      {item.comingSoon ? <ComingSoonBadge compact className="ml-1.5 align-middle" /> : null}
    </>
  );
}

function MatchCentreNavLabel({ isLive }: { isLive: boolean }) {
  return (
    <>
      {isLive ? (
        <span
          className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-crimson shadow-[0_0_6px_rgba(244,42,65,0.8)]"
          aria-hidden
        />
      ) : null}
      Match Centre
    </>
  );
}

export function Navbar({ tourLinks, initialIsLive = false }: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { status } = useSession();
  const isLoggedIn = status === "authenticated";
  const isLive = useLiveMatchStatus(initialIsLive);
  const navItems = buildMainNav(tourLinks);

  return (
    <header className="sticky top-0 z-50 border-b-4 border-crimson bg-white/95 shadow-lg backdrop-blur-md">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 py-4 md:px-8">
        <Link href="/" className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/tigers-den-logo-nav.png"
            alt="The Tigers' Den"
            width={48}
            height={48}
            className="h-12 w-12 shrink-0 object-contain drop-shadow-[0_4px_14px_rgba(0,106,78,0.45)]"
            decoding="async"
          />
          <div className="hidden sm:block">
            <p className="font-display text-lg font-extrabold uppercase leading-tight text-emerald">
              The Tigers&apos; Den
            </p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-crimson">
              Bangladesh Fan Army
            </p>
          </div>
        </Link>

        <nav className="hidden items-center gap-1 xl:flex" aria-label="Main">
          {navItems.map((item) =>
            "children" in item && item.children ? (
              <div key={item.label} className="group relative">
                <Link
                  href={item.href}
                  className="px-3 py-2 text-sm font-bold uppercase tracking-wide text-charcoal transition-colors hover:text-emerald"
                >
                  {item.label}
                </Link>
                <div className="invisible absolute left-0 top-full z-50 min-w-[220px] border-2 border-emerald bg-white py-2 opacity-0 shadow-lg transition-all group-hover:visible group-hover:opacity-100">
                  {item.children.map((child) => (
                    <Link
                      key={`${child.label}-${child.href}`}
                      href={child.href}
                      className="block px-4 py-2 text-sm font-semibold text-charcoal hover:bg-emerald/10 hover:text-emerald"
                    >
                      {child.label}
                    </Link>
                  ))}
                </div>
              </div>
            ) : item.label === "Match Centre" ? (
              <Link
                key={item.label}
                href={item.href}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-bold uppercase tracking-wide transition-colors ${
                  isLive
                    ? "nav-match-centre-live text-crimson hover:text-crimson-bright"
                    : "text-charcoal hover:text-crimson"
                }`}
                aria-label={isLive ? "Match Centre — live match" : "Match Centre"}
              >
                <MatchCentreNavLabel isLive={isLive} />
              </Link>
            ) : (
              <Link
                key={item.label}
                href={item.href}
                className="flex items-center px-3 py-2 text-sm font-bold uppercase tracking-wide text-charcoal transition-colors hover:text-crimson"
              >
                <NavLinkLabel item={item} />
              </Link>
            ),
          )}
        </nav>

        <div className="flex items-center gap-2">
          {isLoggedIn ? (
            <span
              className="hidden cursor-default rounded bg-charcoal/15 px-4 py-2.5 text-xs font-extrabold uppercase tracking-wide text-charcoal/40 sm:inline-block"
              aria-disabled
            >
              Join Us
            </span>
          ) : (
            <Link
              href={JOIN_PAGE_PATH}
              className="fan-btn-red hidden rounded px-4 py-2.5 text-xs sm:inline-block"
            >
              Join Us
            </Link>
          )}
          <button
            type="button"
            className="rounded border-2 border-emerald px-3 py-2 text-xs font-bold uppercase text-emerald xl:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-expanded={mobileOpen}
            aria-label="Toggle menu"
          >
            Menu
          </button>
        </div>
      </div>

      {mobileOpen ? (
        <nav className="border-t border-emerald/20 bg-surface px-4 py-3 xl:hidden">
          {navItems.map((item) =>
            "children" in item && item.children ? (
              <div key={item.label} className="border-b border-emerald/10 py-2">
                <Link
                  href={item.href}
                  className="block text-sm font-bold uppercase text-emerald"
                  onClick={() => setMobileOpen(false)}
                >
                  {item.label}
                </Link>
                <ul className="mt-2 space-y-1 pl-3">
                  {item.children.map((child) => (
                    <li key={`${child.label}-${child.href}`}>
                      <Link
                        href={child.href}
                        className="block py-1.5 text-xs font-semibold text-charcoal/80"
                        onClick={() => setMobileOpen(false)}
                      >
                        {child.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : item.label === "Match Centre" ? (
              <Link
                key={item.label}
                href={item.href}
                className={`flex items-center gap-2 border-b border-emerald/10 py-2.5 text-sm font-bold uppercase ${
                  isLive ? "nav-match-centre-live text-crimson" : "text-charcoal"
                }`}
                onClick={() => setMobileOpen(false)}
                aria-label={isLive ? "Match Centre — live match" : "Match Centre"}
              >
                <MatchCentreNavLabel isLive={isLive} />
              </Link>
            ) : (
              <Link
                key={item.label}
                href={item.href}
                className="flex items-center border-b border-emerald/10 py-2.5 text-sm font-bold uppercase text-charcoal"
                onClick={() => setMobileOpen(false)}
              >
                <NavLinkLabel item={item} />
              </Link>
            ),
          )}
          {isLoggedIn ? (
            <span
              className="mt-3 block cursor-default rounded bg-charcoal/15 py-3 text-center text-xs font-extrabold uppercase text-charcoal/40"
              aria-disabled
            >
              Join Us
            </span>
          ) : (
            <Link
              href={JOIN_PAGE_PATH}
              className="mt-3 block rounded bg-crimson py-3 text-center text-xs font-extrabold uppercase text-white"
              onClick={() => setMobileOpen(false)}
            >
              Join Us
            </Link>
          )}
        </nav>
      ) : null}
    </header>
  );
}
