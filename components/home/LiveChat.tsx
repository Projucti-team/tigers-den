"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { formatPostTime } from "@/components/profile/format-time";
import { MemberAvatar } from "@/components/profile/MemberAvatar";
import { formatMemberDisplayName } from "@/lib/members/display";
import type { MatchChatMessage, MatchChatSnapshot } from "@/lib/match-chat/types";
import { profilePath, JOIN_PAGE_PATH } from "@/lib/site-content";

const POLL_OPEN_MS = 20_000;
const POLL_CLOSED_MS = 60_000;

export function LiveChat() {
  const { status } = useSession();
  const isLoggedIn = status === "authenticated";
  const [snapshot, setSnapshot] = useState<MatchChatSnapshot | null>(null);
  const [message, setMessage] = useState("");
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  const matchId = snapshot?.matchId ?? null;
  const chatOpen = snapshot?.canPost ?? false;

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/match-chat", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as MatchChatSnapshot;
      setSnapshot(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const pollMs = chatOpen ? POLL_OPEN_MS : POLL_CLOSED_MS;
    const timer = window.setInterval(() => void refresh(), pollMs);
    return () => window.clearInterval(timer);
  }, [refresh, chatOpen]);

  useEffect(() => {
    if (!stickToBottom.current || !scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [snapshot?.messages.length]);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!matchId || !message.trim() || !isLoggedIn || !chatOpen) return;

    setPosting(true);
    setPostError(null);
    try {
      const res = await fetch("/api/match-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId, message }),
      });
      const data = (await res.json()) as { message?: MatchChatMessage; error?: string };
      if (!res.ok) {
        setPostError(data.error ?? "Could not send message. Try again.");
        return;
      }
      const posted = data.message;
      if (!posted) return;
      setSnapshot((prev) =>
        prev && prev.matchId
          ? { ...prev, messages: [...prev.messages, posted] }
          : prev,
      );
      setMessage("");
      stickToBottom.current = true;
      void refresh();
    } finally {
      setPosting(false);
    }
  }

  const messages = snapshot?.messages ?? [];
  const title = snapshot?.matchTitle ?? "The Roar";

  return (
    <section className="fan-card flex h-full min-h-[420px] flex-col">
      <div className="fan-card-header-red px-4 py-3">
        <h2 className="font-display text-sm font-extrabold uppercase tracking-wider md:text-base">
          📣 The Roar — Live Chat
        </h2>
        {matchId ? (
          <p className="mt-1 truncate text-xs font-semibold text-white/80">{title}</p>
        ) : null}
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 space-y-3 overflow-y-auto bg-gradient-to-b from-crimson/5 to-emerald/5 p-4"
      >
        {!matchId ? (
          <p className="text-center text-sm text-charcoal/60">
            No match chat right now. Head to Match Centre on match day.
          </p>
        ) : loading && !messages.length ? (
          <p className="text-center text-sm text-charcoal/60">Loading The Roar…</p>
        ) : messages.length === 0 ? (
          <p className="text-center text-sm text-charcoal/60">
            No messages yet — be the first to roar for Bangladesh.
          </p>
        ) : (
          messages.map((entry, i) => (
            <div
              key={entry.id}
              className={
                i % 2 === 0
                  ? "rounded-xl border-l-4 border-emerald bg-emerald/10 p-3 shadow-sm"
                  : "rounded-xl border-l-4 border-crimson bg-crimson/10 p-3 shadow-sm"
              }
            >
              <div className="flex items-start gap-2">
                <Link href={profilePath(entry.author.username)} className="shrink-0">
                  <MemberAvatar
                    avatarUrl={entry.author.avatarUrl}
                    name={entry.author.name}
                    size="sm"
                  />
                </Link>
                <div className="min-w-0 flex-1">
                  <p
                    className={`font-display text-xs font-extrabold uppercase ${i % 2 === 0 ? "text-emerald" : "text-crimson"}`}
                  >
                    <Link
                      href={profilePath(entry.author.username)}
                      className="hover:underline"
                    >
                      {formatMemberDisplayName(entry.author.name)}
                    </Link>
                    <span className="ml-2 font-mono text-[10px] font-bold normal-case text-charcoal/45">
                      {formatPostTime(entry.createdAt)}
                    </span>
                  </p>
                  <p className="mt-1 text-sm font-medium text-charcoal">&ldquo;{entry.body}&rdquo;</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {!matchId ? null : chatOpen && !isLoggedIn ? (
        <div className="border-t-4 border-amber bg-gradient-to-r from-emerald/20 to-crimson/20 p-4 text-center">
          <p className="text-sm font-medium text-charcoal">
            You need to sign in to join The Roar and chat with fellow fans.
          </p>
          <Link
            href={JOIN_PAGE_PATH}
            className="fan-btn-green mt-3 inline-block rounded-lg px-6 py-2.5 text-xs font-extrabold uppercase"
          >
            Sign in to chat
          </Link>
        </div>
      ) : chatOpen && isLoggedIn ? (
        <form
          className="border-t-4 border-amber bg-gradient-to-r from-emerald/20 to-crimson/20 p-3"
          onSubmit={(e) => void handleSubmit(e)}
        >
          <label htmlFor="chat-input" className="sr-only">
            Type message
          </label>
          <div className="flex gap-2">
            <input
              id="chat-input"
              type="text"
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                if (postError) setPostError(null);
              }}
              maxLength={500}
              placeholder="🔥 Type your roar…"
              className="flex-1 rounded-lg border-2 border-emerald bg-white px-3 py-2.5 text-sm font-semibold text-charcoal placeholder:text-charcoal/45 outline-none focus:border-crimson focus:ring-2 focus:ring-crimson/30"
            />
            <button
              type="submit"
              disabled={posting || !message.trim()}
              className="fan-btn-green shrink-0 rounded-lg px-4 py-2.5 text-xs hover:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {posting ? "…" : "Send"}
            </button>
          </div>
          {postError ? (
            <p className="mt-2 text-center text-xs font-semibold text-crimson">{postError}</p>
          ) : null}
        </form>
      ) : (
        <div className="border-t-4 border-charcoal/15 bg-charcoal/5 p-4 text-center">
          <p className="text-sm font-semibold text-charcoal/60">
            Chat closed — scroll above to read past messages.
          </p>
          {snapshot?.endedAt ? (
            <p className="mt-1 text-xs text-charcoal/45">
              New messages closed 30 minutes after full time.
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}
