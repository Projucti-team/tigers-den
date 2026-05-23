import { ChantOfWeek } from "@/components/home/ChantOfWeek";
import { StandForum } from "@/components/home/StandForum";

type Thread = {
  id: string;
  pinned?: boolean;
  hot?: boolean;
  title: string;
  author: string;
  replies: number;
  ago: string;
};

type Props = {
  threads?: Thread[];
};

export function HomeCommunitySection({ threads }: Props) {
  return (
    <section className="border-y-4 border-emerald/20 bg-white py-14 md:py-20">
      <div className="mx-auto max-w-[1440px] px-4 md:px-8">
        <h2 className="text-center font-display text-2xl font-extrabold uppercase md:text-3xl">
          <span className="fan-gradient-text">Join the Tigers&apos; Den in the stands</span>
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-sm text-charcoal/75">
          Forum discussions, chants, and match-day meetups — the heart of our fan army.
        </p>

        <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_340px]" id="the-stand">
          <StandForum threads={threads} />
          <div id="chants">
            <ChantOfWeek />
          </div>
        </div>
      </div>
    </section>
  );
}
