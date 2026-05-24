import Link from "next/link";

import { MemberAvatar } from "@/components/profile/MemberAvatar";
import { profilePath } from "@/lib/site-content";
import type { SocialPost } from "@/lib/social/types";

export function PostCard({ post }: { post: SocialPost }) {
  const when = new Date(post.createdAt).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <article className="rounded-lg border-2 border-emerald/25 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <MemberAvatar avatarUrl={post.author.avatarUrl} name={post.author.name} />
        <div>
          <Link
            href={profilePath(post.author.username)}
            className="font-display text-sm font-extrabold uppercase text-emerald hover:text-crimson"
          >
            {post.author.name}
          </Link>
          <p className="text-xs text-charcoal/55">@{post.author.username} · {when}</p>
        </div>
      </div>

      <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-charcoal">{post.body}</p>

      {post.imageUrls.length > 0 ? (
        <div
          className={`mt-3 grid gap-2 ${post.imageUrls.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}
        >
          {post.imageUrls.map((url) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={url}
              src={url}
              alt=""
              className="max-h-80 w-full rounded-lg object-cover"
            />
          ))}
        </div>
      ) : null}
    </article>
  );
}
