"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useState } from "react";

import { MemberAvatar } from "@/components/profile/MemberAvatar";
import { formatMemberDisplayName } from "@/lib/members/display";
import type { MemberSearchResult } from "@/lib/social/types";

type ProfileHeaderProps = {
  profile: MemberSearchResult;
  postCount: number;
  isOwnProfile: boolean;
  isAuthenticated: boolean;
  avatarUploading: boolean;
  avatarError: string | null;
  followBusy: boolean;
  onAvatarPick: (e: ChangeEvent<HTMLInputElement>) => void;
  onToggleFollow: () => void;
  onUsernameUpdated?: (username: string) => void;
};

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-center md:text-left">
      <p className="font-display text-lg font-extrabold text-white md:text-xl">{value}</p>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-white/50">{label}</p>
    </div>
  );
}

export function ProfileHeader({
  profile,
  postCount,
  isOwnProfile,
  isAuthenticated,
  avatarUploading,
  avatarError,
  followBusy,
  onAvatarPick,
  onToggleFollow,
  onUsernameUpdated,
}: ProfileHeaderProps) {
  const [editingHandle, setEditingHandle] = useState(false);
  const [handleDraft, setHandleDraft] = useState(profile.username);
  const [handleError, setHandleError] = useState<string | null>(null);
  const [savingHandle, setSavingHandle] = useState(false);

  async function saveHandle(e: FormEvent) {
    e.preventDefault();
    setSavingHandle(true);
    setHandleError(null);
    try {
      const res = await fetch("/api/social/profile/username", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: handleDraft }),
      });
      const data = (await res.json()) as { username?: string; error?: string };
      if (!res.ok || !data.username) {
        setHandleError(data.error ?? "Could not update username.");
        return;
      }
      setEditingHandle(false);
      onUsernameUpdated?.(data.username);
    } finally {
      setSavingHandle(false);
    }
  }

  return (
    <header className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-md">
      <div
        className="h-28 bg-gradient-to-r from-emerald/80 via-emerald-bright/60 to-emerald/40 md:h-36"
        aria-hidden
      />

      <div className="relative px-5 pb-6 pt-0 md:px-8 md:pb-8">
        <div className="-mt-14 flex flex-col gap-5 md:-mt-16 md:flex-row md:items-end md:gap-8">
          <div className="flex flex-col items-center gap-2 md:items-start">
            <div className="rounded-full p-1 ring-2 ring-white/20 ring-offset-2 ring-offset-[#061410]">
              <MemberAvatar
                key={profile.avatarUrl ?? "default"}
                avatarUrl={profile.avatarUrl}
                name={profile.name}
                size="xl"
              />
            </div>
            {isOwnProfile ? (
              <>
                <label className="cursor-pointer rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-white/80 transition hover:bg-white/15">
                  {avatarUploading ? "Uploading…" : "Edit photo"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="sr-only"
                    onChange={onAvatarPick}
                    disabled={avatarUploading}
                  />
                </label>
                {avatarError ? (
                  <p className="max-w-[200px] text-center text-[10px] leading-snug text-crimson-glow md:text-left">
                    {avatarError}
                  </p>
                ) : null}
              </>
            ) : null}
          </div>

          <div className="min-w-0 flex-1 text-center md:text-left">
            <div className="flex flex-col items-center gap-3 md:flex-row md:flex-wrap md:items-center md:justify-between">
              <div className="min-w-0">
                <h1 className="truncate font-display text-2xl font-bold tracking-tight text-white md:text-[1.75rem]">
                  {formatMemberDisplayName(profile.name)}
                </h1>

                {editingHandle && isOwnProfile ? (
                  <form onSubmit={saveHandle} className="mt-2 flex max-w-xs flex-col gap-2 md:max-w-sm">
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-white/40">@</span>
                      <input
                        value={handleDraft}
                        onChange={(e) => setHandleDraft(e.target.value)}
                        className="min-w-0 flex-1 rounded-lg border border-white/15 bg-white/5 px-2 py-1.5 text-sm text-white outline-none focus:border-emerald-glow/50"
                        autoFocus
                        aria-label="Username"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={savingHandle}
                        className="rounded-lg bg-emerald px-3 py-1 text-xs font-bold text-white disabled:opacity-50"
                      >
                        {savingHandle ? "Saving…" : "Save"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingHandle(false);
                          setHandleDraft(profile.username);
                          setHandleError(null);
                        }}
                        className="rounded-lg px-3 py-1 text-xs font-semibold text-white/60 hover:text-white"
                      >
                        Cancel
                      </button>
                    </div>
                    {handleError ? (
                      <p className="text-left text-[11px] text-crimson-glow">{handleError}</p>
                    ) : null}
                  </form>
                ) : (
                  <p className="mt-1 flex items-center justify-center gap-2 md:justify-start">
                    <span className="font-mono text-sm text-white/45">@{profile.username}</span>
                    {isOwnProfile ? (
                      <button
                        type="button"
                        onClick={() => {
                          setHandleDraft(profile.username);
                          setEditingHandle(true);
                        }}
                        className="text-[11px] font-semibold text-white/35 underline-offset-2 hover:text-white/60 hover:underline"
                      >
                        Edit
                      </button>
                    ) : null}
                  </p>
                )}
              </div>

              <div className="flex shrink-0 gap-2">
                {!isOwnProfile && isAuthenticated ? (
                  <button
                    type="button"
                    disabled={followBusy}
                    onClick={onToggleFollow}
                    className={`rounded-lg px-5 py-2 text-xs font-extrabold uppercase tracking-wide transition ${
                      profile.isFollowing
                        ? "border border-white/25 bg-white/10 text-white/80 hover:bg-white/15"
                        : "fan-btn-green"
                    }`}
                  >
                    {profile.isFollowing ? "Following" : "Follow"}
                  </button>
                ) : null}
              </div>
            </div>

            <div className="mt-5 flex justify-center gap-8 md:justify-start md:gap-10">
              <Stat value={postCount} label="Posts" />
              <Stat value={profile.followerCount} label="Followers" />
              <Stat value={profile.followingCount} label="Following" />
            </div>

            {profile.bio ? (
              <p className="mt-4 max-w-lg text-sm leading-relaxed text-white/75">{profile.bio}</p>
            ) : isOwnProfile ? (
              <p className="mt-4 text-sm text-white/40">Add a bio from your account settings.</p>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
