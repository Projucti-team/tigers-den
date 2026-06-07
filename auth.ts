import NextAuth from "next-auth";
// import Facebook from "next-auth/providers/facebook";
import Google from "next-auth/providers/google";

import { upsertMemberFromOAuth, type MemberProvider } from "@/lib/members/service";

function providerSlug(id: string | undefined): MemberProvider | null {
  if (id === "google") return "google";
  if (id === "facebook") return "facebook";
  return null;
}

function authProviders() {
  const providers = [];
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    providers.push(
      Google({
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      }),
    );
  }
  // Facebook login disabled until Meta app review / business verification is done.
  // if (process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET) {
  //   providers.push(
  //     Facebook({
  //       clientId: process.env.FACEBOOK_CLIENT_ID,
  //       clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
  //       authorization: {
  //         params: {
  //           scope: "email public_profile",
  //         },
  //       },
  //     }),
  //   );
  // }
  return providers;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: authProviders(),
  callbacks: {
    async signIn({ user, account }) {
      const provider = providerSlug(account?.provider);
      const email =
        user.email?.trim().toLowerCase() ||
        (provider === "facebook" && account?.providerAccountId
          ? `fb_${account.providerAccountId}@users.tigersden.local`
          : null);
      const name = user.name?.trim() || email?.split("@")[0] || "Member";
      if (!provider || !email) return false;

      try {
        await upsertMemberFromOAuth({
          email,
          name,
          provider,
          providerAccountId: account?.providerAccountId,
          imageUrl: user.image,
        });
      } catch (err) {
        console.error("[auth] Failed to save member:", err);
        return false;
      }

      return true;
    },
    session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
});
