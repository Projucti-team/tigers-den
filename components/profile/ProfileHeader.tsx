import type { ChangeEvent } from "react";

import { MemberAvatar } from "@/components/profile/MemberAvatar";
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
}: ProfileHeaderProps) {
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
              <div>
                <h1 className="font-display text-xl font-extrabold uppercase tracking-wide text-white md:text-2xl">
                  {profile.name}
                </h1>
                <p className="mt-0.5 text-sm font-semibold text-emerald-glow">@{profile.username}</p>
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
