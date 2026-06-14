"use client";

import Link from "next/link";
import { useState } from "react";

import { CommentThread } from "@/components/stand/CommentThread";
import { ReactionBar } from "@/components/stand/ReactionBar";
import { formatPostTime } from "@/components/profile/format-time";
import { formatMemberDisplayName } from "@/lib/members/display";
import { resolveMediaSrc } from "@/lib/media";
import { MemberAvatar } from "@/components/profile/MemberAvatar";
import { profilePath } from "@/lib/site-content";
import type { SocialPost } from "@/lib/social/types";

type PostCardProps = {
  post: SocialPost;
  commentsExpanded?: boolean;
  canManage?: boolean;
  onUpdated?: (post: SocialPost) => void;
  onDeleted?: (postId: number) => void;
};

export function PostCard({
  post,
  commentsExpanded = false,
  canManage = false,
  onUpdated,
  onDeleted,
}: PostCardProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(post.body);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const when = formatPostTime(post.createdAt);

  async function saveEdit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/social/posts/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: draft }),
      });
      const data = (await res.json()) as { post?: SocialPost; error?: string };
      if (!res.ok || !data.post) {
        setError(data.error ?? "Could not save changes");
        return;
      }
      onUpdated?.(data.post);
      setEditing(false);
    } catch {
      setError("Could not save changes");
    } finally {
      setBusy(false);
    }
  }

  async function removePost() {
    if (!window.confirm("Delete this post? This cannot be undone.")) return;

    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/social/posts/${post.id}`, { method: "DELETE" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not delete post");
        return;
      }
      onDeleted?.(post.id);
    } catch {
      setError("Could not delete post");
    } finally {
      setBusy(false);
    }
  }

  function cancelEdit() {
    setDraft(post.body);
    setEditing(false);
    setError(null);
  }

  return (
    <article className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-md">
      <div className="flex items-start justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Link href={profilePath(post.author.username)} className="shrink-0">
            <MemberAvatar avatarUrl={post.author.avatarUrl} name={post.author.name} size="md" />
          </Link>
          <div className="min-w-0 flex-1">
            <Link
              href={profilePath(post.author.username)}
              className="block truncate text-sm font-semibold text-white hover:text-emerald-glow"
            >
              {formatMemberDisplayName(post.author.name)}
            </Link>
            <p className="truncate font-mono text-xs text-white/45">
              @{post.author.username} · {when}
            </p>
          </div>
        </div>

        {canManage && !editing ? (
          <div className="flex shrink-0 gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setDraft(post.body);
                setEditing(true);
                setError(null);
              }}
              className="text-xs font-bold uppercase text-emerald-glow hover:text-white disabled:opacity-50"
            >
              Edit
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void removePost()}
              className="text-xs font-bold uppercase text-crimson-glow hover:underline disabled:opacity-50"
            >
              Delete
            </button>
          </div>
        ) : null}
      </div>

      {editing ? (
        <div className="px-4 pb-3">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={4}
            disabled={busy}
            className="w-full resize-y rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-emerald-glow/50 disabled:opacity-60"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || !draft.trim()}
              onClick={() => void saveEdit()}
              className="fan-btn-green rounded-lg px-4 py-1.5 text-xs disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={cancelEdit}
              className="rounded-lg border border-white/20 px-4 py-1.5 text-xs font-bold uppercase text-white/60"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : post.body.trim() ? (
        <p className="px-4 pb-3 whitespace-pre-wrap text-sm leading-relaxed text-white/90">
          {post.body}
        </p>
      ) : null}

      {post.imageUrls.length > 0 ? (
        <div
          className={`grid gap-0.5 ${
            post.imageUrls.length === 1
              ? "grid-cols-1"
              : post.imageUrls.length === 2
                ? "grid-cols-2"
                : "grid-cols-2"
          }`}
        >
          {post.imageUrls.map((url, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={url}
              src={resolveMediaSrc(url) ?? url}
              alt=""
              className={`w-full object-cover ${
                post.imageUrls.length === 1
                  ? "max-h-[28rem]"
                  : post.imageUrls.length > 2 && i === 0
                    ? "col-span-2 max-h-64"
                    : "aspect-square max-h-48"
              }`}
            />
          ))}
        </div>
      ) : null}

      {error ? <p className="px-4 pb-2 text-xs text-crimson-glow">{error}</p> : null}

      <div className="px-4 py-3">
        <ReactionBar
          targetType="member-post"
          targetId={post.id}
          initial={post.reactions}
          compact
        />
      </div>

      <CommentThread
        targetType="member-post"
        targetId={post.id}
        initialCount={post.commentCount ?? 0}
        defaultExpanded={commentsExpanded}
      />
    </article>
  );
}
