"use client";

import { PostCard } from "@/components/profile/PostCard";
import type { SocialPost } from "@/lib/social/types";

type PostModalProps = {
  post: SocialPost | null;
  onClose: () => void;
  canManage?: boolean;
  onUpdated?: (post: SocialPost) => void;
  onDeleted?: (postId: number) => void;
};

export function PostModal({
  post,
  onClose,
  canManage = false,
  onUpdated,
  onDeleted,
}: PostModalProps) {
  if (!post) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-white/10 px-3 py-1 text-sm font-bold text-white hover:bg-white/20"
          >
            Close
          </button>
        </div>
        <PostCard
          post={post}
          commentsExpanded
          canManage={canManage}
          onUpdated={onUpdated}
          onDeleted={(id) => {
            onDeleted?.(id);
            onClose();
          }}
        />
      </div>
    </div>
  );
}
