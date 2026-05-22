export type CricketFormat = "test" | "odi" | "t20";
export type Gender = "men" | "women";

export type ApiMeta = {
  fetchedAt: string;
  providers: string[];
  warnings: string[];
};

export type Tour = {
  id: string;
  name: string;
  startDate?: string;
  endDate?: string;
  dateTimeGMT?: string;
  odi?: number;
  t20?: number;
  test?: number;
  matches?: number;
  teams?: string[];
};

export type LiveMatchSummary = {
  id: string;
  name: string;
  matchType?: string;
  status: string;
  venue?: string;
  date?: string;
  dateTimeGMT?: string;
  teams?: string[];
  teamInfo?: { name: string; shortname?: string; img?: string }[];
  score?: { r: number; w: number; o: number; inning?: string }[];
  isLive: boolean;
};

export type ScorecardPlayer = {
  name: string;
  runs?: number;
  balls?: number;
  fours?: number;
  sixes?: number;
  sr?: number;
  wickets?: number;
  overs?: string;
  economy?: number;
  dismissed?: string;
};

export type ScorecardInnings = {
  inning: string;
  runs: number;
  wickets: number;
  overs: number;
  batting: ScorecardPlayer[];
  bowling: ScorecardPlayer[];
};

export type Scorecard = {
  id: string;
  name: string;
  status: string;
  venue?: string;
  teams?: string[];
  innings: ScorecardInnings[];
};

export type RankedPlayer = {
  rank: number;
  /** ICC uses "=" for tied positions (same rank as the row above) */
  rankTied?: boolean;
  name: string;
  team: string;
  rating: number;
  points?: number;
  imageUrl?: string;
};

export type RankedTeam = {
  rank: number;
  name: string;
  abbreviation: string;
  rating: number;
  points?: number;
  matches?: number;
};

export type FormatRankings = {
  format: CricketFormat;
  topBatsmen: RankedPlayer[];
  topBowlers: RankedPlayer[];
  topAllRounders: RankedPlayer[];
  /** Highest-ranked Bangladesh players in this format */
  topBangladeshBatsman: RankedPlayer | null;
  topBangladeshBowler: RankedPlayer | null;
  topBangladeshAllRounder: RankedPlayer | null;
};

export type GenderRankings = {
  gender: Gender;
  teams: Record<CricketFormat, RankedTeam[]>;
  bangladesh: Record<CricketFormat, RankedTeam | null>;
  players: Record<CricketFormat, FormatRankings>;
};

export type CricketDashboard = {
  meta: ApiMeta;
  tours: Tour[];
  live: {
    matches: LiveMatchSummary[];
    bangladeshMatch: LiveMatchSummary | null;
    scorecard: Scorecard | null;
  };
  rankings: {
    men: GenderRankings;
    women: GenderRankings;
  };
};
