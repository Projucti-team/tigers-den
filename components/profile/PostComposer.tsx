import type { ChangeEvent, FormEvent } from "react";

import { MemberAvatar } from "@/components/profile/MemberAvatar";

type PostComposerProps = {
  avatarUrl?: string | null;
  name: string;
  postBody: string;
  pendingImages: { id: number; url: string }[];
  uploading: boolean;
  posting: boolean;
  onBodyChange: (value: string) => void;
  onImagePick: (e: ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (e: FormEvent) => void;
  onRemoveImage?: (id: number) => void;
};

export function PostComposer({
  avatarUrl,
  name,
  postBody,
  pendingImages,
  uploading,
  posting,
  onBodyChange,
  onImagePick,
  onSubmit,
  onRemoveImage,
}: PostComposerProps) {
  const canPost = postBody.trim().length > 0 || pendingImages.length > 0;

  return (
    <form
      onSubmit={onSubmit}
      className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-md"
    >
      <div className="flex gap-3 border-b border-white/10 p-4">
        <MemberAvatar avatarUrl={avatarUrl} name={name} size="md" />
        <label htmlFor="post-body" className="sr-only">
          Write a post
        </label>
        <textarea
          id="post-body"
          value={postBody}
          onChange={(e) => onBodyChange(e.target.value)}
          placeholder="What's on your mind, Tiger?"
          rows={2}
          className="min-h-[3.5rem] flex-1 resize-none bg-transparent text-sm leading-relaxed text-white placeholder:text-white/40 outline-none"
        />
      </div>

      {pendingImages.length > 0 ? (
        <div className="flex flex-wrap gap-2 border-b border-white/10 px-4 py-3">
          {pendingImages.map((img) => (
            <div key={img.id} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt="" className="h-20 w-20 rounded-lg object-cover" />
              {onRemoveImage ? (
                <button
                  type="button"
                  onClick={() => onRemoveImage(img.id)}
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-charcoal text-[10px] text-white"
                  aria-label="Remove image"
                >
                  ×
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <label className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wide text-emerald-glow transition hover:bg-white/5">
          <span aria-hidden>📷</span>
          {uploading ? "Uploading…" : "Photo"}
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={onImagePick}
            disabled={uploading}
          />
        </label>
        <button
          type="submit"
          disabled={posting || !canPost}
          className="rounded-lg bg-emerald px-5 py-2 text-xs font-extrabold uppercase tracking-wide text-white transition hover:bg-emerald-bright disabled:opacity-40"
        >
          {posting ? "Posting…" : "Post"}
        </button>
      </div>
    </form>
  );
}
