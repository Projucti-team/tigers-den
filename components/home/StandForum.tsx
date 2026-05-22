import { mockThreads } from "@/lib/data";

type Thread = {
  id: string;
  pinned?: boolean;
  hot?: boolean;
  title: string;
  author: string;
  replies: number;
  ago: string;
};

type Props = {
  threads?: Thread[];
};

export function StandForum({ threads = mockThreads }: Props) {
  return (
    <section className="overflow-hidden rounded-lg border-2 border-emerald bg-white shadow-md">
      <div className="border-b-2 border-emerald bg-emerald px-5 py-3">
        <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-white">
          The Stand — Trending Discussions
        </h2>
      </div>

      <ul>
        {threads.map((thread, i) => (
          <li
            key={thread.id}
            className={i % 2 === 0 ? "bg-white" : "bg-emerald/5"}
          >
            <article className="border-b border-emerald/10 p-5 transition-colors hover:bg-crimson/5">
              <div className="flex items-start gap-2">
                {thread.pinned && (
                  <span className="rounded bg-amber px-2 py-0.5 text-[10px] font-extrabold text-pitch">
                    PIN
                  </span>
                )}
                {thread.hot && (
                  <span className="rounded bg-crimson px-2 py-0.5 text-[10px] font-extrabold text-white">
                    HOT
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-charcoal hover:text-emerald">{thread.title}</h3>
                  <p className="mt-1 font-mono text-xs uppercase text-charcoal/60">
                    {thread.author} · {thread.replies} replies · {thread.ago}
                  </p>
                </div>
              </div>
            </article>
          </li>
        ))}
      </ul>
    </section>
  );
}
