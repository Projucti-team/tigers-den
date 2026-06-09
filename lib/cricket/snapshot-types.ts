import type { RankingsShowcase, WtcShowcase } from "@/lib/cricket/services/rankings-display";
import type { TourDetail } from "@/lib/cricket/tour-detail-types";
import type { TourCard } from "@/lib/cricket/services/tours-display";
import type { Tour } from "@/lib/cricket/types";

export type SnapshotMeta = {
  fetchedAt: string;
  warnings: string[];
};

/** Bump when rankings page shape changes — triggers rebuild on read and on deploy bootstrap. */
export const RANKINGS_SHOWCASE_VERSION = 2;

export type RankingsShowcaseSnapshot = SnapshotMeta & {
  version?: number;
  men: RankingsShowcase;
  women: RankingsShowcase;
  wtc: WtcShowcase | null;
};

export type ToursIndexSnapshot = SnapshotMeta & {
  tours: Tour[];
  cards: TourCard[];
  navLinks: { label: string; href: string }[];
};

export type TourDetailSnapshot = SnapshotMeta & TourDetail & {
  slug: string;
};
