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
  seriesId?: string;
  seriesName?: string;
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
  maidens?: number;
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

export type LiveBall = {
  over: number;
  ball: number;
  label: string;
  runs: number;
  isWicket: boolean;
};

export type LiveOverBalls = {
  overNumber: number;
  balls: LiveBall[];
  runsInOver: number;
};

export type LiveMatchFeed = {
  batters: ScorecardPlayer[];
  bowlers: ScorecardPlayer[];
  partnership?: string;
  lastWicket?: string;
  recentOvers: LiveOverBalls[];
};

export type RankedPlayer = {
  rank: number;
  /** ICC uses "=" for tied positions (same rank as the row above) */
  rankTied?: boolean;
  name: string;
  team: string;
  rating: number;
  points?: number;
  /** Sportz.io / icc-cricket.com player id */
  iccPlayerId?: string;
  /** e.g. https://www.icc-cricket.com/rankings/63872/najmul-hossain-shanto */
  profileUrl?: string;
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

export type IccRankDates = {
  team: string | null;
  bat: string | null;
  bowl: string | null;
  allrounder: string | null;
};

export type GenderRankings = {
  gender: Gender;
  teams: Record<CricketFormat, RankedTeam[]>;
  bangladesh: Record<CricketFormat, RankedTeam | null>;
  players: Record<CricketFormat, FormatRankings>;
  /** ICC rank_date per table — team/bat/bowl/allrounder update on different days. */
  rankUpdatedAt?: Record<CricketFormat, IccRankDates>;
};

export type WtcTeamStanding = {
  rank: number;
  team: string;
  abbreviation: string;
  played: number;
  won: number;
  lost: number;
  drawn: number;
  tied: number;
  noResult: number;
  points: number;
  pct: number;
};

export type WtcStandingsSnapshot = {
  fetchedAt: string;
  source: string;
  cycleLabel: string;
  standings: WtcTeamStanding[];
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
