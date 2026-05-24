import { notFound } from "next/navigation";

import { PageHero } from "@/components/pages/PageHero";
import { TourDetailView } from "@/components/tours/TourDetailView";
import { getTourDetail } from "@/lib/cricket/services/tour-detail";
import { shortenTitle } from "@/lib/cricket/services/tours-display";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const detail = await getTourDetail(slug);
  if (!detail) return { title: "Tour — The Tigers' Den" };

  return {
    title: `${shortenTitle(detail.tour.name)} — Tours — The Tigers' Den`,
    description: `Fixtures, squads, venues and travel guide for ${detail.tour.name}.`,
  };
}

export default async function TourSeriesPage({ params }: PageProps) {
  const { slug } = await params;
  const detail = await getTourDetail(slug);
  if (!detail) notFound();

  return (
    <>
      <PageHero
        label="Tour guide"
        title={detail.card.title}
        subtitle={detail.card.description}
      />
      <TourDetailView detail={detail} />
    </>
  );
}
