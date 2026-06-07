"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";

import { PostCard } from "@/components/profile/PostCard";
import { PostComposer } from "@/components/profile/PostComposer";
import { PostGrid } from "@/components/profile/PostGrid";
import { PostModal } from "@/components/profile/PostModal";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { MemberAvatar } from "@/components/profile/MemberAvatar";
import { formatMemberDisplayName } from "@/lib/members/display";
import { JOIN_PAGE_PATH, profilePath } from "@/lib/site-content";
import type { MemberSearchResult, SocialPost } from "@/lib/social/types";

type Tab = "posts" | "feed" | "timeline" | "discover";

type ProfileAppProps = {
  username: string;
  isOwnProfile: boolean;
};

const OWN_TABS: { id: Tab; label: string }[] = [
  { id: "posts", label: "Posts" },
  { id: "feed", label: "Feed" },
  { id: "timeline", label: "Timeline" },
  { id: "discover", label: "Discover" },
];

export function ProfileApp({ username, isOwnProfile }: ProfileAppProps) {
  const router = useRouter();
  const { status } = useSession();
  const [tab, setTab] = useState<Tab>("posts");
  const [profile, setProfile] = useState<MemberSearchResult | null>(null);
  const [profilePosts, setProfilePosts] = useState<SocialPost[]>([]);
  const [feedPosts, setFeedPosts] = useState<SocialPost[]>([]);
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
  const [selectedPost, setSelectedPost] = useState<SocialPost | null>(null);

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
      setProfilePosts(data.posts);

      if (isOwnProfile) {
        const feedRes = await fetch("/api/social/feed");
        if (feedRes.ok) {
          const feedData = (await feedRes.json()) as { posts: SocialPost[] };
          setFeedPosts(feedData.posts);
        } else {
          setFeedPosts([]);
        }
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
      setTab("posts");
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
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] py-16 text-center backdrop-blur-md">
        <p className="text-white/75">
          <Link href={JOIN_PAGE_PATH} className="font-semibold text-emerald-glow hover:underline">
            Sign in
          </Link>{" "}
          to view your profile.
        </p>
      </div>
    );
  }

  if (loading && !profile) {
    return <p className="py-16 text-center text-sm text-white/50">Loading profile…</p>;
  }

  if (!profile) {
    return <p className="text-center text-crimson-glow">Profile not found.</p>;
  }

  const activeTab = isOwnProfile ? tab : "posts";

  return (
    <div className="mx-auto max-w-3xl">
      <ProfileHeader
        profile={profile}
        postCount={profilePosts.length}
        isOwnProfile={isOwnProfile}
        isAuthenticated={status === "authenticated"}
        avatarUploading={avatarUploading}
        avatarError={avatarError}
        followBusy={followBusy === profile.username}
        onAvatarPick={handleAvatarPick}
        onToggleFollow={() => void toggleFollow(profile.username, profile.isFollowing)}
        onUsernameUpdated={(next) => router.replace(profilePath(next))}
      />

      {isOwnProfile ? (
        <nav
          className="sticky top-[4.5rem] z-10 mt-6 flex border-b border-white/10 bg-[#061410]/90 backdrop-blur-md"
          aria-label="Profile sections"
        >
          {OWN_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex-1 py-3 text-center text-xs font-extrabold uppercase tracking-wide transition ${
                activeTab === t.id
                  ? "border-b-2 border-emerald-glow text-white"
                  : "text-white/45 hover:text-white/70"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      ) : (
        <div className="mt-6 flex border-b border-white/10">
          <span className="flex-1 border-b-2 border-emerald-glow py-3 text-center text-xs font-extrabold uppercase tracking-wide text-white">
            Posts
          </span>
        </div>
      )}

      <div className="mt-6 space-y-4">
        {isOwnProfile && activeTab === "feed" ? (
          <PostComposer
            avatarUrl={profile.avatarUrl}
            name={profile.name}
            postBody={postBody}
            pendingImages={pendingImages}
            uploading={uploading}
            posting={posting}
            onBodyChange={setPostBody}
            onImagePick={handleImagePick}
            onSubmit={submitPost}
            onRemoveImage={(id) =>
              setPendingImages((prev) => prev.filter((img) => img.id !== id))
            }
          />
        ) : null}

        {activeTab === "posts" ? (
          <PostGrid posts={profilePosts} onSelect={setSelectedPost} />
        ) : null}

        {isOwnProfile && activeTab === "feed" ? (
          feedPosts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/15 py-12 text-center">
              <p className="text-sm text-white/60">Your feed is empty.</p>
              <p className="mt-1 text-xs text-white/40">
                Follow other fans in Discover to see their posts here.
              </p>
            </div>
          ) : (
            feedPosts.map((post) => <PostCard key={post.id} post={post} />)
          )
        ) : null}

        {isOwnProfile && activeTab === "timeline" ? (
          timelineLoading ? (
            <p className="py-12 text-center text-sm text-white/50">Loading timeline…</p>
          ) : timelinePosts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/15 py-12 text-center">
              <p className="text-sm text-white/60">No posts on the timeline yet.</p>
            </div>
          ) : (
            timelinePosts.map((post) => <PostCard key={post.id} post={post} />)
          )
        ) : null}

        {isOwnProfile && activeTab === "discover" ? (
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-md">
            <div className="border-b border-white/10 p-4">
              <label htmlFor="member-search" className="sr-only">
                Search members
              </label>
              <input
                id="member-search"
                type="search"
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder="Search fans by name or @username"
                className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 outline-none focus:border-emerald-glow/50"
              />
            </div>
            <ul className="divide-y divide-white/10">
              {searchResults.length === 0 && searchQ.trim() ? (
                <li className="px-4 py-8 text-center text-sm text-white/50">No members found.</li>
              ) : null}
              {searchResults.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <Link href={profilePath(m.username)}>
                      <MemberAvatar avatarUrl={m.avatarUrl} name={m.name} size="md" />
                    </Link>
                    <div className="min-w-0">
                      <Link
                        href={profilePath(m.username)}
                        className="block truncate font-semibold text-white hover:text-emerald-glow"
                      >
                        {formatMemberDisplayName(m.name)}
                      </Link>
                      <p className="truncate font-mono text-xs text-white/45">@{m.username}</p>
                    </div>
                  </div>
                  {m.username !== profile.username ? (
                    <button
                      type="button"
                      disabled={followBusy === m.username}
                      onClick={() => void toggleFollow(m.username, m.isFollowing)}
                      className={`shrink-0 rounded-lg px-4 py-1.5 text-xs font-bold uppercase ${
                        m.isFollowing
                          ? "border border-white/25 bg-white/10 text-white/70"
                          : "fan-btn-green"
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
      </div>

      <PostModal post={selectedPost} onClose={() => setSelectedPost(null)} />
    </div>
  );
}
