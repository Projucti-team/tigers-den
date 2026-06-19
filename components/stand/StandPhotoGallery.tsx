import Link from "next/link";

import { formatMemberDisplayName } from "@/lib/members/display";
import { resolveMediaSrc } from "@/lib/media";
import { JOIN_PAGE_PATH, profilePath } from "@/lib/site-content";
import type { SocialPost } from "@/lib/social/types";

type GalleryItem = {
  post: SocialPost;
  imageUrl: string;
  imageIndex: number;
};

function flattenPostImages(posts: SocialPost[]): GalleryItem[] {
  const items: GalleryItem[] = [];

  for (const post of posts) {
    post.imageUrls.forEach((imageUrl, imageIndex) => {
      if (resolveMediaSrc(imageUrl)) {
        items.push({ post, imageUrl, imageIndex });
      }
    });
  }

  return items;
}

type StandPhotoGalleryProps = {
  posts: SocialPost[];
};

export function StandPhotoGallery({ posts }: StandPhotoGalleryProps) {
  const items = flattenPostImages(posts);

  if (!items.length) {
    return (
      <div className="rounded-2xl border border-dashed border-white/15 py-16 text-center">
        <p className="text-4xl" aria-hidden>
          📷
        </p>
        <p className="mt-3 text-sm font-semibold text-white/75">No fan photos yet</p>
        <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-white/50">
          Be the first to share match-day moments from the terrace. Post photos from your member
          profile and they&apos;ll appear here.
        </p>
        <Link href={JOIN_PAGE_PATH} className="fan-btn-green mt-6 inline-block rounded px-6 py-3 text-sm">
          Join &amp; share photos
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 md:gap-3">
      {items.map((item) => {
        const src = resolveMediaSrc(item.imageUrl)!;
        const authorName = formatMemberDisplayName(item.post.author.name);

        return (
          <Link
            key={`${item.post.id}-${item.imageIndex}`}
            href={profilePath(item.post.author.username)}
            className="group relative aspect-square overflow-hidden rounded-lg border border-white/10 bg-white/5"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={`Photo shared by ${authorName}`}
              className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-black/45 opacity-0 transition group-hover:opacity-100" />
            <div className="absolute inset-x-0 bottom-0 translate-y-1 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-3 opacity-0 transition group-hover:translate-y-0 group-hover:opacity-100">
              <p className="truncate text-xs font-semibold text-white">{authorName}</p>
              <p className="truncate font-mono text-[10px] text-white/60">
                @{item.post.author.username}
              </p>
            </div>
            {item.post.imageUrls.length > 1 && item.imageIndex === 0 ? (
              <span className="absolute right-2 top-2 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[10px] font-bold text-white">
                +{item.post.imageUrls.length}
              </span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}
