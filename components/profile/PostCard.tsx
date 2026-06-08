import Link from "next/link";

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
};

export function PostCard({ post, commentsExpanded = false }: PostCardProps) {
  const when = formatPostTime(post.createdAt);

  return (
    <article className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-md">
      <div className="flex items-center gap-3 px-4 py-3">
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

      {post.body.trim() ? (
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
