import { mockChant } from "@/lib/data";

export function ChantOfWeek() {
  const chant = mockChant;

  return (
    <section className="overflow-hidden rounded-lg border-2 border-crimson bg-white shadow-md">
      <div className="border-b-2 border-crimson bg-crimson px-5 py-3">
        <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-white">
          Chant of the Week
        </h2>
      </div>

      <div className="space-y-4 p-5">
        <p className="font-display text-lg font-extrabold uppercase text-emerald">
          {chant.title}
        </p>
        <div className="space-y-1 text-sm italic text-charcoal/80">
          {chant.lines.map((line) => (
            <p key={line}>&ldquo;{line}&rdquo;</p>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 pt-2">
          <button
            type="button"
            className="rounded bg-emerald px-4 py-2 text-xs font-extrabold uppercase text-white hover:bg-emerald-bright"
          >
            Listen
          </button>
          <button
            type="button"
            className="rounded border-2 border-crimson px-4 py-2 text-xs font-extrabold uppercase text-crimson hover:bg-crimson/5"
          >
            Lyrics
          </button>
        </div>
      </div>
    </section>
  );
}
