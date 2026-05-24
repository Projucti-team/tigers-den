import type { SeriesSquad } from "@/lib/cricket/curated-squads";
import type { TourCard } from "@/lib/cricket/services/tours-display";
import type { Tour, LiveMatchSummary } from "@/lib/cricket/types";
import type { VenueGuide } from "@/lib/cricket/venues";

export type TourDetail = {
  tour: Tour;
  card: TourCard;
  matches: LiveMatchSummary[];
  squads: SeriesSquad[];
  venues: VenueGuide[];
  warnings: string[];
};
