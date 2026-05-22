"use client";

import Link from "next/link";
import { useState } from "react";

import { navItems } from "@/lib/site-content";

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b-4 border-crimson bg-white shadow-md">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 py-4 md:px-8">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-emerald to-crimson text-2xl text-white shadow-md">
            🐅
          </span>
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
                <div className="invisible absolute left-0 top-full z-50 min-w-[200px] border-2 border-emerald bg-white py-2 opacity-0 shadow-lg transition-all group-hover:visible group-hover:opacity-100">
                  {item.children.map((child) => (
                    <Link
                      key={child.label}
                      href={child.href}
                      className="block px-4 py-2 text-sm font-semibold text-charcoal hover:bg-emerald/10 hover:text-emerald"
                    >
                      {child.label}
                    </Link>
                  ))}
                </div>
              </div>
            ) : (
              <Link
                key={item.label}
                href={item.href}
                className="px-3 py-2 text-sm font-bold uppercase tracking-wide text-charcoal transition-colors hover:text-crimson"
              >
                {item.label}
              </Link>
            ),
          )}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="#membership"
            className="hidden rounded bg-crimson px-4 py-2.5 text-xs font-extrabold uppercase tracking-wide text-white transition-opacity hover:opacity-90 sm:inline-block"
          >
            Join Us
          </Link>
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

      {mobileOpen && (
        <nav className="border-t border-emerald/20 bg-surface px-4 py-3 xl:hidden">
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="block border-b border-emerald/10 py-2.5 text-sm font-bold uppercase text-charcoal"
              onClick={() => setMobileOpen(false)}
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="#membership"
            className="mt-3 block rounded bg-crimson py-3 text-center text-xs font-extrabold uppercase text-white"
            onClick={() => setMobileOpen(false)}
          >
            Join Us
          </Link>
        </nav>
      )}
    </header>
  );
}
