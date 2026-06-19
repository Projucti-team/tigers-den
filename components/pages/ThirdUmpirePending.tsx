import type { CSSProperties } from "react";
export function ThirdUmpirePending() {
  return (
    <div
      className="third-umpire-monitor mx-auto w-full max-w-md"
      role="status"
      aria-live="polite"
      aria-label="Decision pending — third umpire is reviewing"
    >
      <div className="third-umpire-monitor__scan" aria-hidden />

      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="third-umpire-live-dot" aria-hidden />
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-white/70">
            Live review
          </span>
        </div>
        <span className="rounded border border-amber/40 bg-amber/10 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-amber">
          DRS
        </span>
      </div>

      <div className="relative flex flex-col items-center px-6 py-10">
        <div className="third-umpire-stage" aria-hidden>
          <div className="third-umpire-ring">
            {Array.from({ length: 8 }, (_, i) => (
              <span key={i} className="third-umpire-ring-dot" style={{ "--i": i } as CSSProperties} />
            ))}
          </div>

          <div className="third-umpire-headset">
            <svg viewBox="0 0 64 64" className="h-14 w-14" fill="none" aria-hidden>
              <path
                d="M32 10c-9.4 0-17 7.1-17 15.8v9.4c0 1.5 1.2 2.6 2.6 2.6h2.6v-12c0-6.5 5.3-11.8 11.8-11.8s11.8 5.3 11.8 11.8v12h2.6c1.5 0 2.6-1.2 2.6-2.6v-9.4C49 17.1 41.4 10 32 10Z"
                fill="currentColor"
                opacity="0.9"
              />
              <rect x="14" y="34" width="8" height="14" rx="4" fill="currentColor" />
              <rect x="42" y="34" width="8" height="14" rx="4" fill="currentColor" />
              <path
                d="M22 48h20a6 6 0 0 1 6 6v2H16v-2a6 6 0 0 1 6-6Z"
                fill="currentColor"
                opacity="0.75"
              />
            </svg>
          </div>
        </div>

        <p className="third-umpire-title font-display mt-8 text-center text-2xl font-extrabold uppercase tracking-wide md:text-3xl">
          Decision Pending
        </p>

        <p className="mt-2 text-center font-mono text-xs uppercase tracking-[0.18em] text-white/60">
          3rd Umpire is reviewing
          <span className="third-umpire-ellipsis" aria-hidden>
            <span>.</span>
            <span>.</span>
            <span>.</span>
          </span>
        </p>

        <div className="third-umpire-progress mt-8 w-full" aria-hidden>
          <div className="third-umpire-progress-bar" />
        </div>

        <p className="mt-4 text-center text-[11px] font-mono uppercase tracking-widest text-white/35">
          Please stand by for the call
        </p>
      </div>
    </div>
  );
}
