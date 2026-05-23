import Link from "next/link";

export function TopBar() {
  return (
    <div className="fan-gradient-bar animate-shimmer-bar border-b-2 border-amber/80 text-white">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-2 px-4 py-2 text-xs md:px-8">
        <p className="font-display font-bold uppercase tracking-wide drop-shadow-sm">
          We are The Tigers&apos; Den
        </p>
        <div className="flex flex-wrap items-center gap-3 md:gap-5">
          <Link href="#membership" className="font-semibold hover:text-amber">
            Register
          </Link>
          <span className="text-white/40" aria-hidden>
            |
          </span>
          <Link href="#membership" className="font-semibold hover:text-amber">
            My Account
          </Link>
          <span className="text-white/40" aria-hidden>
            |
          </span>
          <Link href="#about" className="font-semibold hover:text-amber">
            Contact Us
          </Link>
          <div className="ml-2 flex gap-2 border-l border-white/30 pl-3">
            <a href="#" className="hover:text-amber" aria-label="X / Twitter">
              𝕏
            </a>
            <a href="#" className="hover:text-amber" aria-label="Facebook">
              f
            </a>
            <a href="#" className="hover:text-amber" aria-label="Instagram">
              ◎
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
