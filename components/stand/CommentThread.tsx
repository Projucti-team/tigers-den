"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";

import { formatPostTime } from "@/components/profile/format-time";
import { MemberAvatar } from "@/components/profile/MemberAvatar";
import { formatMemberDisplayName } from "@/lib/members/display";
import { profilePath, JOIN_PAGE_PATH } from "@/lib/site-content";
import type { StandComment } from "@/lib/stand/engagement-types";
import type { CommentTargetType } from "@/lib/stand/engagement-types";

type CommentThreadProps = {
  targetType: CommentTargetType;
  targetId: number;
  initialCount?: number;
  defaultExpanded?: boolean;
  onCountChange?: (count: number) => void;
};

export function CommentThread({
  targetType,
  targetId,
  initialCount = 0,
  defaultExpanded = false,
  onCountChange,
}: CommentThreadProps) {
  const { status } = useSession();
  const [comments, setComments] = useState<StandComment[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [expanded, setExpanded] = useState(defaultExpanded);

  const loadComments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/stand/comments?targetType=${encodeURIComponent(targetType)}&targetId=${targetId}`,
      );
      if (!res.ok) return;
      const data = (await res.json()) as { comments: StandComment[] };
      setComments(data.comments);
      onCountChange?.(data.comments.length);
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, [targetType, targetId, onCountChange]);

  useEffect(() => {
    if ((expanded || defaultExpanded) && !loaded) {
      void loadComments();
    }
  }, [expanded, defaultExpanded, loaded, loadComments]);

  async function submitComment(e: React.FormEvent) {
    e.preventDefault();
    if (status !== "authenticated") {
      window.location.href = JOIN_PAGE_PATH;
      return;
    }
    if (!body.trim()) return;

    setPosting(true);
    try {
      const res = await fetch("/api/stand/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType, targetId, body }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { comment: StandComment };
      setComments((prev) => {
        const next = [...prev, data.comment];
        onCountChange?.(next.length);
        return next;
      });
      setBody("");
    } finally {
      setPosting(false);
    }
  }

  const count = loaded ? comments.length : initialCount;

  return (
    <div className="border-t border-white/10">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-white/55 hover:bg-white/[0.03] hover:text-white/80"
      >
        <span>
          {count > 0 ? `${count} comment${count === 1 ? "" : "s"}` : "Comment"}
        </span>
        <span aria-hidden>{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded ? (
        <div className="space-y-3 border-t border-white/10 px-4 py-3">
          {loading ? (
            <p className="text-xs text-white/45">Loading comments…</p>
          ) : comments.length === 0 ? (
            <p className="text-xs text-white/45">No comments yet — start the conversation.</p>
          ) : (
            <ul className="space-y-3">
              {comments.map((comment) => (
                <li key={comment.id} className="flex gap-2">
                  <Link href={profilePath(comment.author.username)} className="shrink-0">
                    <MemberAvatar
                      avatarUrl={comment.author.avatarUrl}
                      name={comment.author.name}
                      size="sm"
                    />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-white/80">
                      <Link
                        href={profilePath(comment.author.username)}
                        className="font-semibold text-white hover:text-emerald-glow"
                      >
                        {formatMemberDisplayName(comment.author.name)}
                      </Link>{" "}
                      <span className="font-mono text-white/40">
                        · {formatPostTime(comment.createdAt)}
                      </span>
                    </p>
                    <p className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed text-white/85">
                      {comment.body}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <form onSubmit={(e) => void submitComment(e)} className="flex gap-2 pt-1">
            <label htmlFor={`comment-${targetType}-${targetId}`} className="sr-only">
              Write a comment
            </label>
            <input
              id={`comment-${targetType}-${targetId}`}
              type="text"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={
                status === "authenticated" ? "Add a comment…" : "Sign in to comment"
              }
              maxLength={2000}
              className="min-w-0 flex-1 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:border-emerald-glow/50"
            />
            <button
              type="submit"
              disabled={posting || !body.trim()}
              className="fan-btn-green shrink-0 rounded-lg px-3 py-2 text-xs font-bold uppercase disabled:opacity-40"
            >
              {posting ? "…" : "Post"}
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
