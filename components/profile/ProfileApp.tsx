"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";

import { MemberAvatar } from "@/components/profile/MemberAvatar";
import { PostCard } from "@/components/profile/PostCard";
import { JOIN_PAGE_PATH } from "@/lib/site-content";
import type { MemberSearchResult, SocialPost } from "@/lib/social/types";

type Tab = "feed" | "timeline" | "write" | "discover";

type ProfileAppProps = {
  username: string;
  isOwnProfile: boolean;
};

export function ProfileApp({ username, isOwnProfile }: ProfileAppProps) {
  const { status } = useSession();
  const [tab, setTab] = useState<Tab>(isOwnProfile ? "feed" : "feed");
  const [profile, setProfile] = useState<MemberSearchResult | null>(null);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [postBody, setPostBody] = useState("");
  const [uploading, setUploading] = useState(false);
  const [pendingImages, setPendingImages] = useState<{ id: number; url: string }[]>([]);
  const [posting, setPosting] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<MemberSearchResult[]>([]);
  const [followBusy, setFollowBusy] = useState<string | null>(null);
  const [timelinePosts, setTimelinePosts] = useState<SocialPost[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/social/members/${encodeURIComponent(username)}`);
      if (!res.ok) throw new Error("not found");
      const data = (await res.json()) as {
        profile: MemberSearchResult;
        posts: SocialPost[];
      };
      setProfile(data.profile);

      if (isOwnProfile) {
        const feedRes = await fetch("/api/social/feed");
        if (feedRes.ok) {
          const feedData = (await feedRes.json()) as { posts: SocialPost[] };
          setPosts(feedData.posts);
        } else {
          setPosts(data.posts);
        }
      } else {
        setPosts(data.posts);
      }
    } finally {
      setLoading(false);
    }
  }, [username, isOwnProfile]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (!isOwnProfile || tab !== "timeline") return;

    setTimelineLoading(true);
    fetch("/api/social/timeline")
      .then((res) => (res.ok ? res.json() : { posts: [] }))
      .then((data) => setTimelinePosts((data as { posts: SocialPost[] }).posts ?? []))
      .finally(() => setTimelineLoading(false));
  }, [tab, isOwnProfile]);

  useEffect(() => {
    if (tab !== "discover" || !searchQ.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(() => {
      fetch(`/api/social/members/search?q=${encodeURIComponent(searchQ.trim())}`)
        .then((res) => (res.ok ? res.json() : { members: [] }))
        .then((data) => setSearchResults(data.members ?? []));
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQ, tab]);

  async function handleAvatarPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const isHeic =
      /image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
    if (isHeic) {
      setAvatarError(
        "iPhone HEIC photos cannot display in the browser. Save as JPEG or PNG, then upload again.",
      );
      e.target.value = "";
      return;
    }

    setAvatarUploading(true);
    setAvatarError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/social/profile/avatar", { method: "POST", body: form });
      const data = (await res.json()) as { avatarUrl?: string; error?: string };
      if (!res.ok || !data.avatarUrl) {
        setAvatarError(data.error ?? "Could not update profile photo. Try a JPEG or PNG.");
        return;
      }
      const bust = data.avatarUrl.includes("?") ? "&" : "?";
      setProfile((prev) =>
        prev ? { ...prev, avatarUrl: `${data.avatarUrl}${bust}v=${Date.now()}` } : prev,
      );
    } finally {
      setAvatarUploading(false);
      e.target.value = "";
    }
  }

  async function handleImagePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/social/upload", { method: "POST", body: form });
      if (!res.ok) throw new Error("upload failed");
      const data = (await res.json()) as { id: number; url: string };
      setPendingImages((prev) => [...prev, data]);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function submitPost(e: React.FormEvent) {
    e.preventDefault();
    setPosting(true);
    try {
      const res = await fetch("/api/social/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: postBody,
          imageIds: pendingImages.map((img) => img.id),
        }),
      });
      if (!res.ok) throw new Error("post failed");
      setPostBody("");
      setPendingImages([]);
      setTab("feed");
      await loadProfile();
    } finally {
      setPosting(false);
    }
  }

  async function toggleFollow(targetUsername: string, currentlyFollowing: boolean) {
    setFollowBusy(targetUsername);
    try {
      const res = currentlyFollowing
        ? await fetch(
            `/api/social/follow?username=${encodeURIComponent(targetUsername)}`,
            { method: "DELETE" },
          )
        : await fetch("/api/social/follow", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: targetUsername }),
          });
      if (!res.ok) throw new Error("follow failed");
      await loadProfile();
      if (tab === "discover") {
        const searchRes = await fetch(
          `/api/social/members/search?q=${encodeURIComponent(searchQ.trim())}`,
        );
        const data = await searchRes.json();
        setSearchResults(data.members ?? []);
      }
    } finally {
      setFollowBusy(null);
    }
  }

  if (status === "unauthenticated" && isOwnProfile) {
    return (
      <p className="text-center text-charcoal/75">
        <Link href={JOIN_PAGE_PATH} className="font-semibold text-emerald hover:underline">
          Sign in
        </Link>{" "}
        to view your profile.
      </p>
    );
  }

  if (loading && !profile) {
    return <p className="py-16 text-center text-sm text-charcoal/60">Loading profile…</p>;
  }

  if (!profile) {
    return <p className="text-center text-crimson">Profile not found.</p>;
  }

  return (
    <div className="mx-auto max-w-2xl">
      <header className="rounded-lg border-2 border-emerald/30 bg-white p-6 shadow-md">
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex flex-col items-center gap-2">
            <MemberAvatar
              key={profile.avatarUrl ?? "default"}
              avatarUrl={profile.avatarUrl}
              name={profile.name}
              size="lg"
            />
            {isOwnProfile ? (
              <>
                <label className="cursor-pointer rounded border-2 border-emerald/40 px-2 py-1 text-[10px] font-bold uppercase text-emerald hover:bg-emerald/5">
                  {avatarUploading ? "Uploading…" : "Change photo"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="sr-only"
                    onChange={handleAvatarPick}
                    disabled={avatarUploading}
                  />
                </label>
                {avatarError ? (
                  <p className="max-w-[140px] text-center text-[10px] leading-snug text-crimson">
                    {avatarError}
                  </p>
                ) : null}
              </>
            ) : null}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-2xl font-extrabold uppercase text-charcoal">
              {profile.name}
            </h1>
            <p className="text-sm font-semibold text-emerald">@{profile.username}</p>
            {profile.bio ? (
              <p className="mt-2 text-sm text-charcoal/75">{profile.bio}</p>
            ) : null}
            <p className="mt-2 text-xs text-charcoal/55">
              {profile.followerCount} followers · {profile.followingCount} following
            </p>
          </div>
          {!isOwnProfile && status === "authenticated" ? (
            <button
              type="button"
              disabled={followBusy === profile.username}
              onClick={() => void toggleFollow(profile.username, profile.isFollowing)}
              className={`rounded px-4 py-2 text-xs font-extrabold uppercase ${
                profile.isFollowing
                  ? "border-2 border-charcoal/20 text-charcoal/60"
                  : "fan-btn-green"
              }`}
            >
              {profile.isFollowing ? "Following" : "Follow"}
            </button>
          ) : null}
        </div>
      </header>

      {isOwnProfile ? (
        <div className="mt-6 flex gap-2 border-b-2 border-emerald/20">
          {(["feed", "timeline", "write", "discover"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-xs font-extrabold uppercase tracking-wide ${
                tab === t
                  ? "border-b-4 border-crimson text-crimson"
                  : "text-charcoal/50 hover:text-emerald"
              }`}
            >
              {t === "feed"
                ? "My feed"
                : t === "timeline"
                  ? "Timeline"
                  : t === "write"
                    ? "Write post"
                    : "Find fans"}
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-6 space-y-4">
        {isOwnProfile && tab === "write" ? (
          <form
            onSubmit={submitPost}
            className="rounded-lg border-2 border-emerald/30 bg-white p-4 shadow-sm"
          >
            <label htmlFor="post-body" className="sr-only">
              Write a post
            </label>
            <textarea
              id="post-body"
              value={postBody}
              onChange={(e) => setPostBody(e.target.value)}
              placeholder="Share your match-day roar…"
              rows={4}
              className="w-full resize-y rounded border-2 border-emerald/30 px-3 py-2 text-sm outline-none focus:border-emerald"
            />
            {pendingImages.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {pendingImages.map((img) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={img.id}
                    src={img.url}
                    alt=""
                    className="h-20 w-20 rounded object-cover"
                  />
                ))}
              </div>
            ) : null}
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <label className="cursor-pointer rounded border-2 border-emerald/40 px-3 py-2 text-xs font-bold uppercase text-emerald hover:bg-emerald/5">
                {uploading ? "Uploading…" : "Add photo"}
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={handleImagePick}
                  disabled={uploading}
                />
              </label>
              <button
                type="submit"
                disabled={posting || (!postBody.trim() && pendingImages.length === 0)}
                className="fan-btn-green rounded px-5 py-2 text-xs disabled:opacity-50"
              >
                {posting ? "Posting…" : "Post"}
              </button>
            </div>
          </form>
        ) : null}

        {isOwnProfile && tab === "discover" ? (
          <div className="rounded-lg border-2 border-emerald/30 bg-white p-4 shadow-sm">
            <label htmlFor="member-search" className="mb-2 block text-sm font-semibold text-charcoal">
              Find other Tigers&apos; Den members
            </label>
            <input
              id="member-search"
              type="search"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="Search by name or @username"
              className="w-full rounded border-2 border-emerald/30 px-3 py-2 text-sm outline-none focus:border-emerald"
            />
            <ul className="mt-4 space-y-3">
              {searchResults.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between gap-3 border-b border-emerald/10 pb-3 last:border-0"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <MemberAvatar avatarUrl={m.avatarUrl} name={m.name} />
                    <div className="min-w-0">
                      <Link
                        href={`/profile/${m.username}`}
                        className="font-semibold text-emerald hover:text-crimson"
                      >
                        {m.name}
                      </Link>
                      <p className="text-xs text-charcoal/55">@{m.username}</p>
                    </div>
                  </div>
                  {m.username !== profile.username ? (
                    <button
                      type="button"
                      disabled={followBusy === m.username}
                      onClick={() => void toggleFollow(m.username, m.isFollowing)}
                      className={`shrink-0 rounded px-3 py-1.5 text-xs font-bold uppercase ${
                        m.isFollowing ? "bg-charcoal/10 text-charcoal/60" : "fan-btn-green"
                      }`}
                    >
                      {m.isFollowing ? "Following" : "Follow"}
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {isOwnProfile && tab === "timeline" ? (
          <>
            <h2 className="font-display text-sm font-extrabold uppercase text-charcoal/70">
              Timeline
            </h2>
            <p className="text-xs text-charcoal/55">
              Public posts from every Tigers&apos; Den member, newest first.
            </p>
            {timelineLoading ? (
              <p className="py-8 text-center text-sm text-charcoal/60">Loading timeline…</p>
            ) : timelinePosts.length === 0 ? (
              <p className="rounded-lg border border-dashed border-emerald/30 bg-white/80 p-8 text-center text-sm text-charcoal/60">
                No posts on the timeline yet.
              </p>
            ) : (
              timelinePosts.map((post) => <PostCard key={post.id} post={post} />)
            )}
          </>
        ) : null}

        {(tab === "feed" || !isOwnProfile) && (
          <>
            <h2 className="font-display text-sm font-extrabold uppercase text-charcoal/70">
              {isOwnProfile ? "Feed" : "Posts"}
            </h2>
            {posts.length === 0 ? (
              <p className="rounded-lg border border-dashed border-emerald/30 bg-white/80 p-8 text-center text-sm text-charcoal/60">
                No posts yet.
                {isOwnProfile ? " Write your first post in the Write post tab." : null}
              </p>
            ) : (
              posts.map((post) => <PostCard key={post.id} post={post} />)
            )}
          </>
        )}
      </div>
    </div>
  );
}
