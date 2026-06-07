import type { SocialPost } from "@/lib/social/types";

type PostGridProps = {
  posts: SocialPost[];
  onSelect: (post: SocialPost) => void;
};

export function PostGrid({ posts, onSelect }: PostGridProps) {
  if (posts.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/15 py-16 text-center">
        <p className="text-4xl" aria-hidden>
          📷
        </p>
        <p className="mt-3 text-sm font-semibold text-white/60">No posts yet</p>
        <p className="mt-1 text-xs text-white/40">When you share photos and updates, they&apos;ll show here.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-1 md:gap-1.5">
      {posts.map((post) => {
        const thumb = post.imageUrls[0];
        const hasText = Boolean(post.body.trim());

        return (
          <button
            key={post.id}
            type="button"
            onClick={() => onSelect(post)}
            className="group relative aspect-square overflow-hidden rounded-sm bg-white/5 md:rounded-md"
          >
            {thumb ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={thumb}
                alt=""
                className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center p-3 text-center">
                <p className="line-clamp-4 text-[10px] leading-snug text-white/70 md:text-xs">
                  {post.body}
                </p>
              </div>
            )}
            <div className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition group-hover:opacity-100">
              {hasText && thumb ? (
                <span className="px-2 text-center text-[10px] font-semibold text-white line-clamp-3">
                  {post.body}
                </span>
              ) : post.imageUrls.length > 1 ? (
                <span className="font-mono text-xs font-bold text-white">
                  +{post.imageUrls.length}
                </span>
              ) : null}
            </div>
          </button>
        );
      })}
    </div>
  );
}
