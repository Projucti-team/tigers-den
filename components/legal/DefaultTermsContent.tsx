import Link from "next/link";

export function DefaultTermsContent() {
  return (
    <div className="space-y-4 text-base leading-relaxed text-white/85">
      <p>
        These Terms of Service (&quot;Terms&quot;) govern your access to and use of tigersden.bd
        (&quot;the Site&quot;) operated by The Tigers&apos; Den (&quot;we&quot;, &quot;us&quot;). By
        creating an account, signing in, or otherwise using the Site, you agree to these Terms. If
        you do not agree, please do not use the Site.
      </p>

      <h2 className="font-display text-sm font-extrabold uppercase text-amber">Eligibility</h2>
      <p>
        You must be at least 13 years old to use the Site. If you are under 18, you should use the
        Site only with permission from a parent or guardian. Membership features require a valid Google
        account for sign-in.
      </p>

      <h2 className="font-display text-sm font-extrabold uppercase text-amber">Your account</h2>
      <p>
        You are responsible for activity on your account and for keeping your sign-in credentials
        secure. Information you provide on your profile must be accurate. We may suspend or remove
        accounts that violate these Terms or that we reasonably believe pose a risk to the community
        or the Site.
      </p>

      <h2 className="font-display text-sm font-extrabold uppercase text-amber">Acceptable use</h2>
      <p>
        When using the Site — including profiles, posts, and The Roar live chat — you agree not to:
      </p>
      <ul className="list-disc space-y-2 pl-5">
        <li>Harass, threaten, abuse, or discriminate against others.</li>
        <li>Post unlawful, defamatory, obscene, or misleading content.</li>
        <li>Impersonate another person or misrepresent your affiliation.</li>
        <li>Spam, advertise without permission, or scrape the Site without our consent.</li>
        <li>Attempt to disrupt, hack, or overload the Site or its connected services.</li>
        <li>Use the Site for any purpose that violates applicable law.</li>
      </ul>
      <p>
        We may remove content or restrict access where we believe it breaches these rules or harms
        the fan community.
      </p>

      <h2 className="font-display text-sm font-extrabold uppercase text-amber">Your content</h2>
      <p>
        You retain ownership of content you post. By posting on the Site, you grant us a
        non-exclusive, worldwide licence to host, display, and distribute that content solely to
        operate and promote the Site. You confirm you have the right to post the content you share.
      </p>

      <h2 className="font-display text-sm font-extrabold uppercase text-amber">
        Cricket data &amp; third-party content
      </h2>
      <p>
        Scores, fixtures, squads, rankings, and news on the Site may come from third-party providers
        and are provided for fan information only. We do not guarantee that this information is
        complete, accurate, or up to date. Third-party services (including Google sign-in and
        Firebase for live chat) are subject to their own terms and policies.
      </p>

      <h2 className="font-display text-sm font-extrabold uppercase text-amber">
        Membership &amp; purchases
      </h2>
      <p>
        Membership tiers, tickets, shop items, and tour packages may be offered from time to time.
        Where payment is required, separate terms shown at checkout will apply. We may change
        pricing, benefits, or availability with reasonable notice where practicable.
      </p>

      <h2 className="font-display text-sm font-extrabold uppercase text-amber">
        Intellectual property
      </h2>
      <p>
        The Tigers&apos; Den name, branding, and original Site content are owned by us or our
        licensors. Bangladesh Cricket Board, ICC, player, and broadcaster names and marks belong to
        their respective owners. Do not use our branding or Site content for commercial purposes
        without our written permission.
      </p>

      <h2 className="font-display text-sm font-extrabold uppercase text-amber">Disclaimer</h2>
      <p>
        The Site is provided on an &quot;as is&quot; and &quot;as available&quot; basis. To the
        fullest extent permitted by law, we disclaim warranties of any kind, whether express or
        implied, including fitness for a particular purpose and non-infringement.
      </p>

      <h2 className="font-display text-sm font-extrabold uppercase text-amber">
        Limitation of liability
      </h2>
      <p>
        To the fullest extent permitted by law, The Tigers&apos; Den and its volunteers, partners,
        and suppliers will not be liable for any indirect, incidental, special, or consequential
        damages arising from your use of the Site, including loss of data or profits, even if we have
        been advised of the possibility of such damages.
      </p>

      <h2 className="font-display text-sm font-extrabold uppercase text-amber">Changes</h2>
      <p>
        We may update these Terms from time to time. The &quot;Last updated&quot; date at the top
        of this page will change when we do. Continued use of the Site after changes take effect
        means you accept the revised Terms.
      </p>

      <h2 className="font-display text-sm font-extrabold uppercase text-amber">Governing law</h2>
      <p>
        These Terms are governed by the laws of Bangladesh, without regard to conflict-of-law
        principles. Any disputes will be subject to the courts of Bangladesh, unless mandatory local
        law requires otherwise.
      </p>

      <h2 className="font-display text-sm font-extrabold uppercase text-amber">Contact</h2>
      <p>
        Questions about these Terms:{" "}
        <a href="mailto:contacttigersden@gmail.com" className="font-semibold text-amber hover:underline">
          contacttigersden@gmail.com
        </a>
        . See also our{" "}
        <Link href="/privacy" className="font-semibold text-emerald-glow hover:underline">
          Privacy Policy
        </Link>
        .
      </p>

      <p className="text-sm text-white/50">
        This is a starter policy and may be updated as the site grows.
      </p>
    </div>
  );
}
