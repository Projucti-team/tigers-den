import Link from "next/link";

export function DefaultPrivacyContent() {
  return (
  <div className="space-y-4 text-base leading-relaxed text-white/85">
    <p>
      The Tigers&apos; Den (&quot;we&quot;, &quot;us&quot;) runs tigersden.bd as a fan community for
      Bangladesh cricket. This policy explains what we collect and why.
    </p>

    <h2 className="font-display text-sm font-extrabold uppercase text-amber">What we collect</h2>
    <ul className="list-disc space-y-2 pl-5">
      <li>
        <strong>Member sign-in (Google):</strong> when you join, we receive your name, email address,
        and profile picture from Google. We store these to create and manage your member profile.
      </li>
      <li>
        <strong>Profile details you add:</strong> optional fields such as country or favourite Tiger
        if you choose to fill them in.
      </li>
      <li>
        <strong>Posts and activity:</strong> content you publish on your profile or the fan feed.
      </li>
      <li>
        <strong>Live chat (The Roar):</strong> messages you post in match-centre chat, stored via
        Firebase so other signed-in fans can see them in real time.
      </li>
      <li>
        <strong>Technical data:</strong> standard server logs (IP address, browser type, pages
        visited) for security and troubleshooting.
      </li>
    </ul>

    <h2 className="font-display text-sm font-extrabold uppercase text-amber">How we use it</h2>
    <p>
      We use your information to operate the site, authenticate members, display profiles and posts,
      and improve the fan experience. We do not sell your personal data.
    </p>

    <h2 className="font-display text-sm font-extrabold uppercase text-amber">Third parties</h2>
    <p>
      Sign-in is provided by Google. Their use of your data is governed by{" "}
      <a
        href="https://policies.google.com/privacy"
        target="_blank"
        rel="noopener noreferrer"
        className="font-semibold text-emerald-glow hover:underline"
      >
        Google&apos;s Privacy Policy
      </a>
      . Live chat is delivered through{" "}
      <a
        href="https://firebase.google.com/support/privacy"
        target="_blank"
        rel="noopener noreferrer"
        className="font-semibold text-emerald-glow hover:underline"
      >
        Firebase
      </a>
      . We may use hosting and analytics providers that process technical data on our behalf.
    </p>

    <h2 className="font-display text-sm font-extrabold uppercase text-amber">Cookies &amp; sessions</h2>
    <p>
      We use essential cookies and session tokens to keep you signed in. We do not use advertising
      cookies. See our{" "}
      <Link href="/terms" className="font-semibold text-emerald-glow hover:underline">
        Terms of Service
      </Link>{" "}
      for rules on using the Site.
    </p>

    <h2 className="font-display text-sm font-extrabold uppercase text-amber">Your choices</h2>
    <p>
      You can sign out at any time. To request access, correction, or deletion of your member data,
      contact us at the email below.
    </p>

    <h2 className="font-display text-sm font-extrabold uppercase text-amber">Contact</h2>
    <p>
      Questions about this policy:{" "}
      <a href="mailto:contacttigersden@gmail.com" className="font-semibold text-amber hover:underline">
        contacttigersden@gmail.com
      </a>
    </p>

    <p className="text-sm text-white/50">
      This is a starter policy and may be updated as the site grows.
    </p>
  </div>
  );
}
