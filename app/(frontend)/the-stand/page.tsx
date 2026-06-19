import Link from "next/link";

import { PageHero } from "@/components/pages/PageHero";
import { StandPhotoGallery } from "@/components/stand/StandPhotoGallery";
import { isPayloadConfigured } from "@/lib/payload-env";
import { getTimelinePostsWithImages } from "@/lib/social/posts";
import { JOIN_PAGE_PATH } from "@/lib/site-content";

export const metadata = {
  title: "The Stand — The Tigers' Den",
  description: "Fan photos and moments from Tigers' Den members — match day, tours, and terrace life.",
};

export const dynamic = "force-dynamic";

export default async function TheStandPage() {
  let posts: Awaited<ReturnType<typeof getTimelinePostsWithImages>> = [];

  if (isPayloadConfigured()) {
    try {
      posts = await getTimelinePostsWithImages(48);
    } catch {
      posts = [];
    }
  }

  return (
    <>
      <PageHero
        label="Fan feed"
        title="The Stand"
        subtitle="Photos from the terrace — shared by Tigers' Den members on match day, on tour, and at home."
      />

      <div className="mx-auto max-w-6xl px-4 py-10 md:px-8 md:py-14">
        <StandPhotoGallery posts={posts} />

        <p className="mt-10 text-center text-sm leading-relaxed text-white/70">
          Threads and debates are launching soon.{" "}
          <Link href={JOIN_PAGE_PATH} className="font-semibold text-emerald-glow hover:text-amber hover:underline">
            Join the Den
          </Link>{" "}
          to share photos from your profile — they&apos;ll show up here for the whole fan army.
        </p>

        <div className="mt-8 text-center">
          <Link href="/" className="fan-btn-green inline-block rounded px-8 py-3 text-sm">
            Back to home
          </Link>
        </div>
      </div>
    </>
  );
}
