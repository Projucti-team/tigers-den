import { Suspense } from "react";

import { MemberJoinPanel } from "@/components/home/MemberJoinPanel";
import { getEnabledAuthProviders, isMemberAuthConfigured } from "@/lib/members/config";
import { MEMBER_COUNT_BASE } from "@/lib/members/constants";
import { getDisplayedMemberCount } from "@/lib/members/service";

export async function BecomeAMemberSection() {
  const memberCount = await getDisplayedMemberCount().catch(() => MEMBER_COUNT_BASE);
  const formattedCount = memberCount.toLocaleString("en-GB");
  const enabledProviders = getEnabledAuthProviders();
  const authConfigured = isMemberAuthConfigured();

  return (
    <section className="bg-surface py-14 md:py-20">
      <div className="mx-auto max-w-[1440px] px-4 md:px-8">
        <div className="text-center">
          <p className="fan-section-label text-emerald">Join the army</p>
          <h2 className="mt-2 font-display text-2xl font-extrabold uppercase text-charcoal md:text-4xl">
            Become a Member
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-charcoal/80">
            Join The Tigers&apos; Den with Google. Priority tickets, member rewards,
            tour windows and the loudest fan community in Bangladesh cricket.
          </p>
          <p className="mt-6 font-display text-3xl font-extrabold tabular-nums text-crimson md:text-4xl">
            {formattedCount}
            <span className="ml-2 text-base font-bold uppercase tracking-wide text-charcoal/70 md:text-lg">
              members &amp; counting
            </span>
          </p>
        </div>

        <div className="mt-10">
          <Suspense
            fallback={
              <p className="py-8 text-center text-sm text-charcoal/70">Loading sign-in…</p>
            }
          >
            <MemberJoinPanel
              authConfigured={authConfigured}
              enabledProviders={enabledProviders}
            />
          </Suspense>
        </div>

        <p className="mx-auto mt-8 max-w-xl text-center text-xs text-charcoal/55">
          We store your email and name from your social account. Country and favourite Tiger are
          optional. Free to join — no payment required today.
        </p>
      </div>
    </section>
  );
}
