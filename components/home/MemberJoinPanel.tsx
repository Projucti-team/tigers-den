"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { SocialSignInButtons } from "@/components/auth/SocialSignInButtons";
import type { AuthProviderId } from "@/lib/members/config";
import { JOIN_PAGE_PATH, PROFILE_PAGE_PATH } from "@/lib/site-content";

const MEMBER_SEEN_KEY = "tigersden-member-seen";

type MemberProfile = {
  email: string;
  name: string;
  country?: string | null;
  favoritePlayer?: string | null;
};

const JOIN_CALLBACK = `${JOIN_PAGE_PATH}?joined=1`;

type MemberJoinPanelProps = {
  authConfigured: boolean;
  enabledProviders: AuthProviderId[];
};

export function MemberJoinPanel({ authConfigured, enabledProviders }: MemberJoinPanelProps) {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [country, setCountry] = useState("");
  const [favoritePlayer, setFavoritePlayer] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isReturning, setIsReturning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    const res = await fetch("/api/members/profile");
    if (!res.ok) return;
    const data = (await res.json()) as { profile: MemberProfile };
    setProfile(data.profile);
    setCountry(data.profile.country ?? "");
    setFavoritePlayer(data.profile.favoritePlayer ?? "");

    if (localStorage.getItem(MEMBER_SEEN_KEY)) {
      setIsReturning(true);
    } else {
      localStorage.setItem(MEMBER_SEEN_KEY, "1");
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated") {
      void loadProfile();
    }
  }, [status, loadProfile]);

  useEffect(() => {
    if (searchParams.get("joined") === "1" && status === "authenticated") {
      router.replace(JOIN_PAGE_PATH);
    }
  }, [searchParams, status, router]);

  async function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      const res = await fetch("/api/members/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          country: country.trim() || undefined,
          favoritePlayer: favoritePlayer.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error || "Could not save profile");
      }

      const data = (await res.json()) as { profile: MemberProfile };
      setProfile(data.profile);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  if (status === "loading") {
    return (
      <p className="py-8 text-center text-sm text-charcoal/70">Checking your session…</p>
    );
  }

  if (!authConfigured) {
    return (
      <p className="mx-auto max-w-md text-center text-sm text-charcoal/75">
        Social sign-in is being set up. Add Google OAuth keys to your environment (see{" "}
        <code className="text-xs">.env.example</code>) to enable joining.
      </p>
    );
  }

  if (status !== "authenticated" || !session?.user) {
    const providerLabel = "Google";

    return (
      <div className="space-y-4">
        <p className="text-center text-sm text-charcoal/75">
          Sign in with {providerLabel} — we&apos;ll save your email and name automatically.
        </p>
        <SocialSignInButtons providers={enabledProviders} callbackUrl={JOIN_CALLBACK} />
      </div>
    );
  }

  const displayName = profile?.name || session.user.name || "Tiger";
  const showWelcomeBack =
    isReturning ||
    saved ||
    Boolean(profile?.country?.trim() || profile?.favoritePlayer?.trim());

  return (
    <div className="mx-auto max-w-lg">
      <div className="rounded-lg border-2 border-emerald/40 bg-white p-6 shadow-md">
        {showWelcomeBack ? (
          <>
            <p className="font-display text-lg font-extrabold uppercase text-emerald">
              Welcome back, {displayName}!
            </p>
            <p className="mt-2 text-sm text-charcoal/75">
              You&apos;re already part of The Tigers&apos; Den.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href={PROFILE_PAGE_PATH}
                className="fan-btn-green rounded px-6 py-3 text-center text-sm"
              >
                Go to Profile
              </Link>
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: JOIN_PAGE_PATH })}
                className="rounded border-2 border-charcoal/20 px-4 py-3 text-sm font-semibold text-charcoal/80 hover:border-crimson hover:text-crimson"
              >
                Sign out
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="font-display text-lg font-extrabold uppercase text-emerald">
              Welcome, {displayName}!
            </p>
            <p className="mt-2 text-sm text-charcoal/75">
              You&apos;re in The Tigers&apos; Den
              {session.user.email ? (
                <>
                  {" "}
                  as <span className="font-semibold">{session.user.email}</span>
                </>
              ) : null}
              .
            </p>

            <form onSubmit={handleProfileSubmit} className="mt-6 space-y-4">
            <p className="text-xs font-bold uppercase tracking-wide text-charcoal/60">
              Optional — tell us a bit more
            </p>
            <div>
              <label htmlFor="member-country" className="mb-1 block text-sm font-semibold text-charcoal">
                Country you live in
              </label>
              <input
                id="member-country"
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="e.g. Bangladesh, UK, USA"
                className="w-full rounded border-2 border-emerald/40 bg-white px-4 py-3 text-sm outline-none focus:border-emerald"
              />
            </div>
            <div>
              <label
                htmlFor="member-favorite-player"
                className="mb-1 block text-sm font-semibold text-charcoal"
              >
                Favourite player
              </label>
              <input
                id="member-favorite-player"
                type="text"
                value={favoritePlayer}
                onChange={(e) => setFavoritePlayer(e.target.value)}
                placeholder="e.g. Shakib Al Hasan"
                className="w-full rounded border-2 border-emerald/40 bg-white px-4 py-3 text-sm outline-none focus:border-emerald"
              />
            </div>

            {error ? <p className="text-sm text-crimson">{error}</p> : null}

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="submit"
                disabled={saving}
                className="fan-btn-green flex-1 rounded py-3 text-sm disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save details"}
              </button>
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: JOIN_PAGE_PATH })}
                className="rounded border-2 border-charcoal/20 px-4 py-3 text-sm font-semibold text-charcoal/80 hover:border-crimson hover:text-crimson"
              >
                Sign out
              </button>
            </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

