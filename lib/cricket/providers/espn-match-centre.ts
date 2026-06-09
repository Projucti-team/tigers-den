import { isBangladeshTeam } from "@/lib/cricket/constants";
import { formatShortDismissal, parseEspnDismissalText } from "@/lib/cricket/dismissal-format";
import type { LiveBall, LiveMatchFeed, LiveOverBalls, Scorecard, ScorecardPlayer } from "@/lib/cricket/types";
import {
  ESPN_CORE_BASE,
  fetchEspnCoreJson,
  fetchEspnCoreList,
  espnEventIdFromMatchId,
} from "@/lib/cricket/providers/espn-core";

const CACHE_MS = 30_000;
const RECENT_BALL_LIMIT = 36;
const DEFAULT_LEAGUE_ID = 24324;

type MatchcardPlayer = {
  playerID?: string;
  playerName?: string;
  dismissal?: string;
  runs?: string;
  ballsFaced?: string;
  fours?: string;
  sixes?: string;
  overs?: string;
  maidens?: string;
  wickets?: string;
  conceded?: string;
  economyRate?: string;
};

type PartnershipRow = {
  partnershipRuns?: string;
  partnershipOvers?: string;
  player1Name?: string;
  player2Name?: string;
  fowType?: string;
};

type Matchcard = {
  typeID?: string;
  headline?: string;
  teamName?: string;
  inningsNumber?: string;
  runs?: string;
  total?: string;
  playerDetails?: MatchcardPlayer[];
};

type MatchcardsResponse = { items?: Matchcard[] };

type DetailParticipant = {
  athlete?: { $ref?: string };
  totalRuns?: number;
  faced?: number;
  fours?: number;
  sixes?: number;
  maidens?: number;
  wickets?: number;
  overs?: number;
  conceded?: number;
};

type DetailBall = {
  id?: string;
  sequence?: number;
  playType?: { id?: string; description?: string };
  scoreValue?: number;
  boundary?: boolean;
  dismissal?: { dismissal?: boolean; text?: string; type?: string };
  shortText?: string;
  batsman?: DetailParticipant;
  otherBatsman?: DetailParticipant;
  bowler?: DetailParticipant;
  over?: {
    number?: number;
    ball?: number;
    wide?: number;
    noBall?: number;
  };
  period?: number;
};

type CoreCompetition = {
  description?: string;
  shortDescription?: string;
  note?: string;
  venue?: { fullName?: string };
};

type TeamInningsSummary = {
  team: string;
  runs: number;
  wickets: number;
  overs: number;
};

let centreCache = new Map<string, { at: number; data: EspnMatchCentrePayload }>();
const inningsAggCache = new Map<
  string,
  { at: number; batting: ScorecardPlayer[]; bowling: ScorecardPlayer[] }
>();
const INNINGS_AGG_CACHE_MS = 6 * 60 * 60 * 1000;
const DISMISSAL_CACHE_MS = 6 * 60 * 60 * 1000;
const ATHLETE_NAME_CACHE = new Map<string, string>();
const dismissalCache = new Map<string, { at: number; map: Map<string, string> }>();

export type EspnMatchCentrePayload = {
  scorecard: Scorecard;
  liveFeed: LiveMatchFeed | null;
};

function num(raw?: string): number {
  const n = Number.parseFloat(raw ?? "");
  return Number.isFinite(n) ? n : 0;
}

function sr(runs: number, balls: number): number | undefined {
  if (!balls) return undefined;
  return Math.round((runs / balls) * 1000) / 10;
}

function formatPlayerName(raw: string): string {
  const parts = raw.trim().split(/\s+/);
  if (parts.length < 2) return raw;
  const [first, ...rest] = parts;
  if (first.length <= 3 && first === first.toUpperCase()) {
    return `${first.charAt(0)} ${rest.join(" ")}`;
  }
  return raw.trim();
}

function mapBattingPlayers(
  players: MatchcardPlayer[],
  dismissalById: Map<string, string> = new Map(),
): ScorecardPlayer[] {
  return players
    .filter((p) => p.runs !== "" && p.runs != null && p.dismissal !== "")
    .map((p) => {
      const runs = num(p.runs);
      const balls = num(p.ballsFaced);
      const notOut = /not out/i.test(p.dismissal ?? "");
      const playerId = p.playerID ?? "";
      const dismissed = notOut
        ? "not out"
        : dismissalById.get(playerId) ?? formatShortDismissal(p.dismissal ?? "out");

      return {
        name: formatPlayerName(p.playerName ?? "Player"),
        runs,
        balls,
        fours: num(p.fours),
        sixes: num(p.sixes),
        sr: sr(runs, balls),
        dismissed,
      };
    });
}

function mapBowlingPlayers(players: MatchcardPlayer[]): ScorecardPlayer[] {
  const seen = new Set<string>();
  const mapped: ScorecardPlayer[] = [];

  for (const p of players) {
    if (!p.overs || num(p.overs) <= 0) continue;
    const row: ScorecardPlayer = {
      name: formatPlayerName(p.playerName ?? "Bowler"),
      overs: p.overs,
      maidens: num(p.maidens),
      wickets: num(p.wickets),
      runs: num(p.conceded),
      economy: num(p.economyRate) || undefined,
    };
    if (seen.has(row.name)) continue;
    seen.add(row.name);
    mapped.push(row);
  }

  return mapped;
}

function parseInningsTotal(total?: string, runs?: string): { runs: number; wickets: number; overs: number } {
  const wkts = total?.match(/(\d+)\s*wkts?/i)?.[1];
  const ovs = total?.match(/([\d.]+)\s*ovs?/i)?.[1];
  return {
    runs: num(runs),
    wickets: wkts ? num(wkts) : 0,
    overs: ovs ? num(ovs) : 0,
  };
}

function ballLabel(detail: DetailBall): string {
  if (detail.dismissal?.dismissal || detail.playType?.id === "9") return "W";
  if ((detail.over?.wide ?? 0) > 0) return "Wd";
  if ((detail.over?.noBall ?? 0) > 0) return "Nb";
  const runs = detail.scoreValue ?? 0;
  if (runs === 0) return "•";
  if (detail.boundary && runs >= 6) return "6";
  if (detail.boundary && runs >= 4) return "4";
  return String(runs);
}

function groupRecentOvers(balls: DetailBall[]): LiveOverBalls[] {
  const byOver = new Map<number, LiveBall[]>();

  for (const detail of balls) {
    const overNum = detail.over?.number;
    if (!overNum) continue;
    const entry: LiveBall = {
      over: overNum,
      ball: detail.over?.ball ?? 0,
      label: ballLabel(detail),
      runs: detail.scoreValue ?? 0,
      isWicket: Boolean(detail.dismissal?.dismissal || detail.playType?.id === "9"),
    };
    const list = byOver.get(overNum) ?? [];
    list.push(entry);
    byOver.set(overNum, list);
  }

  return [...byOver.entries()]
    .sort((a, b) => b[0] - a[0])
    .slice(0, 5)
    .map(([overNumber, overBalls]) => ({
      overNumber,
      balls: overBalls.sort((a, b) => a.ball - b.ball),
      runsInOver: overBalls.reduce((sum, b) => sum + (b.isWicket ? 0 : b.runs), 0),
    }));
}

function partnershipBalls(overs?: string): number {
  if (!overs) return 0;
  const [whole, part] = overs.split(".").map((v) => Number.parseInt(v, 10));
  return (whole || 0) * 6 + (part || 0);
}

function currentPartnership(partnerships?: PartnershipRow[]): string | undefined {
  const active = partnerships?.find((p) => p.fowType === "*") ?? partnerships?.at(-1);
  if (!active?.partnershipRuns) return undefined;

  const runs = num(active.partnershipRuns);
  const balls = partnershipBalls(active.partnershipOvers);
  const rr = balls ? ((runs / balls) * 6).toFixed(1) : "0.0";
  const p1 = formatPlayerName(active.player1Name ?? "");
  const p2 = formatPlayerName(active.player2Name ?? "");
  return `Partnership: ${runs} Runs, ${balls} B (RR: ${rr}) · ${p1} & ${p2}`;
}

function lastWicketText(balls: DetailBall[], batters: ScorecardPlayer[]): string | undefined {
  for (let i = balls.length - 1; i >= 0; i -= 1) {
    const d = balls[i];
    if (d.dismissal?.text) {
      const text = d.dismissal.text.replace(/<[^>]+>/g, "");
      return `Last Bat: ${text}`;
    }
  }

  const dismissed = batters.filter((b) => b.dismissed && !/not out/i.test(b.dismissed));
  const last = dismissed.at(-1);
  if (last?.runs != null) {
    return `Last Bat: ${last.name} ${last.runs} (${last.balls ?? 0}b)`;
  }

  return undefined;
}

async function fetchRecentBalls(compBase: string): Promise<DetailBall[]> {
  const list = await fetchEspnCoreList(`${compBase}/details?pageSize=1`);
  const pageCount = list.pageCount ?? 1;
  const pages = [pageCount - 1, pageCount].filter((p) => p >= 1);

  const refs: { $ref: string }[] = [];
  for (const page of pages) {
    const batch = await fetchEspnCoreList(
      `${compBase}/details?page=${page}&pageSize=${Math.ceil(RECENT_BALL_LIMIT / pages.length)}`,
    );
    refs.push(...(batch.items ?? []));
  }

  const uniqueRefs = [...new Map(refs.map((r) => [r.$ref, r])).values()].slice(-RECENT_BALL_LIMIT);
  const balls = await Promise.all(
    uniqueRefs.map((item) => fetchEspnCoreJson<DetailBall>(item.$ref)),
  );
  return balls
    .filter((b): b is DetailBall => Boolean(b?.id))
    .sort((a, b) => Number(a.id ?? 0) - Number(b.id ?? 0));
}

function bowlerNameFromShortText(shortText?: string): string | null {
  return shortText?.match(/^([^,]+?),/)?.[1]?.trim() ?? null;
}

function findBowler(bowling: ScorecardPlayer[], rawName: string): ScorecardPlayer | undefined {
  const needle = rawName.toLowerCase();
  return bowling.find((b) => {
    const lastName = b.name.split(" ").pop()?.toLowerCase() ?? "";
    return needle.includes(lastName) || lastName.includes(needle.split(" ").pop() ?? "___");
  });
}

function bowlersFromRecentBall(
  bowling: ScorecardPlayer[],
  balls: DetailBall[],
): ScorecardPlayer[] {
  const recentNames: string[] = [];
  for (let i = balls.length - 1; i >= 0 && recentNames.length < 2; i -= 1) {
    const name = bowlerNameFromShortText(balls[i]?.shortText);
    if (name && !recentNames.some((n) => n.toLowerCase() === name.toLowerCase())) {
      recentNames.push(name);
    }
  }

  const picked: ScorecardPlayer[] = [];
  for (const name of recentNames) {
    const bowler = findBowler(bowling, name);
    if (bowler && !picked.some((p) => p.name === bowler.name)) {
      picked.push(bowler);
    }
  }

  if (picked.length) return picked;

  const fallback: ScorecardPlayer[] = [];
  for (const bowler of bowling) {
    if (!fallback.some((p) => p.name === bowler.name)) {
      fallback.push(bowler);
    }
    if (fallback.length >= 2) break;
  }
  return fallback;
}

function markStriker(atCrease: ScorecardPlayer[], balls: DetailBall[]): ScorecardPlayer[] {
  const lastBall = balls.at(-1);
  const strikerMatch = lastBall?.shortText?.match(/to\s+([^,]+),/i);
  const strikerName = strikerMatch?.[1]?.trim().toLowerCase();
  if (!strikerName) {
    return atCrease.map((b) => ({ ...b, name: `${b.name}*` }));
  }

  return atCrease.map((b) => {
    const lastName = b.name.split(" ").pop()?.toLowerCase() ?? "";
    const isStriker = strikerName.includes(lastName) || lastName.includes(strikerName.split(" ").pop() ?? "___");
    return { ...b, name: isStriker ? `${b.name}*` : b.name };
  });
}

async function fetchTeamSummaries(compBase: string): Promise<TeamInningsSummary[]> {
  const competitors = await fetchEspnCoreList(`${compBase}/competitors`);
  const summaries: TeamInningsSummary[] = [];

  for (const item of competitors.items ?? []) {
    const comp = await fetchEspnCoreJson<{
      team?: { $ref: string };
      score?: { $ref: string };
    }>(item.$ref);
    if (!comp?.team?.$ref) continue;

    const team = await fetchEspnCoreJson<{ displayName?: string }>(comp.team.$ref);
    const score = comp.score?.$ref
      ? await fetchEspnCoreJson<{ displayValue?: string; value?: string }>(comp.score.$ref)
      : null;
    const raw = score?.displayValue ?? score?.value ?? "";
    const m = raw.match(/^(\d+)\/(\d+)/);
    const ovs = raw.match(/\(([\d.]+)/);
    if (team?.displayName && m) {
      summaries.push({
        team: team.displayName,
        runs: num(m[1]),
        wickets: num(m[2]),
        overs: ovs ? num(ovs[1]) : 0,
      });
    }
  }

  return summaries;
}

function ordinalInnings(n: number): string {
  const labels = ["1st", "2nd", "3rd", "4th"];
  return labels[n - 1] ?? `${n}th`;
}

function athleteIdFromRef(ref?: string): string | null {
  return ref?.split("/athletes/")[1]?.replace(/\/$/, "") ?? null;
}

function buildDismissalMapFromBalls(balls: DetailBall[], period: number): Map<string, string> {
  const map = new Map<string, string>();
  for (const ball of balls) {
    if (ball.period !== period || !ball.dismissal?.dismissal || !ball.dismissal.text) continue;
    const id = athleteIdFromRef(ball.batsman?.athlete?.$ref);
    if (id) map.set(id, parseEspnDismissalText(ball.dismissal.text));
  }
  return map;
}

async function getDismissalMap(compBase: string, period: number): Promise<Map<string, string>> {
  const key = `${compBase}:d:${period}`;
  const cached = dismissalCache.get(key);
  if (cached && Date.now() - cached.at < DISMISSAL_CACHE_MS) {
    return cached.map;
  }

  const allBalls = await fetchAllDetailBalls(compBase);
  const map = buildDismissalMapFromBalls(allBalls, period);
  dismissalCache.set(key, { at: Date.now(), map });
  return map;
}

async function athleteName(leagueId: number, athleteId: string): Promise<string> {
  const cached = ATHLETE_NAME_CACHE.get(athleteId);
  if (cached) return cached;

  const athlete = await fetchEspnCoreJson<{ displayName?: string; fullName?: string }>(
    `${ESPN_CORE_BASE}/leagues/${leagueId}/athletes/${athleteId}`,
  );
  const name = formatPlayerName(athlete?.displayName ?? athlete?.fullName ?? athleteId);
  ATHLETE_NAME_CACHE.set(athleteId, name);
  return name;
}

async function fetchAllDetailBalls(compBase: string): Promise<DetailBall[]> {
  const meta = await fetchEspnCoreList(`${compBase}/details?pageSize=1`);
  const pageCount = meta.pageCount ?? 1;
  const refs: string[] = [];

  for (let page = 1; page <= pageCount; page += 1) {
    const batch = await fetchEspnCoreList(`${compBase}/details?page=${page}&pageSize=100`);
    for (const item of batch.items ?? []) refs.push(item.$ref);
  }

  const balls: DetailBall[] = [];
  const chunkSize = 30;
  for (let i = 0; i < refs.length; i += chunkSize) {
    const chunk = await Promise.all(
      refs.slice(i, i + chunkSize).map((ref) => fetchEspnCoreJson<DetailBall>(ref)),
    );
    balls.push(...chunk.filter((b): b is DetailBall => Boolean(b?.id)));
  }

  return balls.sort((a, b) => (a.sequence ?? Number(a.id)) - (b.sequence ?? Number(b.id)));
}

async function aggregateInningsFromDetails(
  compBase: string,
  leagueId: number,
  period: number,
): Promise<{ batting: ScorecardPlayer[]; bowling: ScorecardPlayer[] }> {
  const cacheKey = `${compBase}:period:${period}`;
  const cached = inningsAggCache.get(cacheKey);
  if (cached && Date.now() - cached.at < INNINGS_AGG_CACHE_MS) {
    return { batting: cached.batting, bowling: cached.bowling };
  }

  const allBalls = await fetchAllDetailBalls(compBase);
  const periodBalls = allBalls.filter((b) => b.period === period);

  const batterOrder: string[] = [];
  const batters = new Map<
    string,
    { runs: number; balls: number; fours: number; sixes: number; dismissed?: string; seq: number }
  >();
  const bowlers = new Map<
    string,
    { overs: number; runs: number; wickets: number; maidens: number; seq: number }
  >();

  for (const ball of periodBalls) {
    const seq = ball.sequence ?? Number(ball.id ?? 0);

    for (const slot of [ball.batsman, ball.otherBatsman]) {
      const id = athleteIdFromRef(slot?.athlete?.$ref);
      if (!id) continue;
      if (!batterOrder.includes(id)) batterOrder.push(id);
      const prev = batters.get(id);
      if (!prev || seq >= prev.seq) {
        batters.set(id, {
          runs: slot?.totalRuns ?? prev?.runs ?? 0,
          balls: slot?.faced ?? prev?.balls ?? 0,
          fours: slot?.fours ?? prev?.fours ?? 0,
          sixes: slot?.sixes ?? prev?.sixes ?? 0,
          dismissed: prev?.dismissed,
          seq,
        });
      }
    }

    if (ball.dismissal?.dismissal) {
      const outId = athleteIdFromRef(ball.batsman?.athlete?.$ref);
      if (outId) {
        const row = batters.get(outId);
        if (row) {
          batters.set(outId, {
            ...row,
            dismissed: parseEspnDismissalText(ball.dismissal.text ?? "out"),
          });
        }
      }
    }

    const bowlerId = athleteIdFromRef(ball.bowler?.athlete?.$ref);
    if (bowlerId && ball.bowler) {
      const prev = bowlers.get(bowlerId);
      if (!prev || seq >= prev.seq) {
        bowlers.set(bowlerId, {
          overs: ball.bowler.overs ?? prev?.overs ?? 0,
          runs: ball.bowler.conceded ?? prev?.runs ?? 0,
          wickets: ball.bowler.wickets ?? prev?.wickets ?? 0,
          maidens: ball.bowler.maidens ?? prev?.maidens ?? 0,
          seq,
        });
      }
    }
  }

  const athleteIds = [...new Set([...batterOrder, ...bowlers.keys()])];
  await Promise.all(
    athleteIds.map(async (id) => {
      if (!ATHLETE_NAME_CACHE.has(id)) {
        await athleteName(leagueId, id);
      }
    }),
  );

  const batting: ScorecardPlayer[] = [];
  for (const id of batterOrder) {
    const row = batters.get(id);
    if (!row || row.balls <= 0) continue;
    batting.push({
      name: ATHLETE_NAME_CACHE.get(id) ?? id,
      runs: row.runs,
      balls: row.balls,
      fours: row.fours,
      sixes: row.sixes,
      sr: sr(row.runs, row.balls),
      dismissed: row.dismissed ?? "not out",
    });
  }

  const bowling: ScorecardPlayer[] = [...bowlers.entries()]
    .sort((a, b) => a[1].seq - b[1].seq)
    .map(([id, row]) => ({
      name: ATHLETE_NAME_CACHE.get(id) ?? id,
      overs: String(row.overs),
      runs: row.runs,
      wickets: row.wickets,
      maidens: row.maidens,
      economy: row.overs ? Math.round((row.runs / row.overs) * 100) / 100 : undefined,
    }));

  inningsAggCache.set(cacheKey, { at: Date.now(), batting, bowling });
  return { batting, bowling };
}

export async function fetchEspnMatchCentre(
  matchId: string,
  leagueId = DEFAULT_LEAGUE_ID,
): Promise<EspnMatchCentrePayload | null> {
  const eventId = espnEventIdFromMatchId(matchId);
  if (!eventId) return null;

  const cacheKey = `${leagueId}:${eventId}`;
  const cached = centreCache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_MS) {
    return cached.data;
  }

  const compBase = `${ESPN_CORE_BASE}/leagues/${leagueId}/events/${eventId}/competitions/${eventId}`;

  const [competition, matchcards, recentBalls, teamSummaries] = await Promise.all([
    fetchEspnCoreJson<CoreCompetition>(compBase),
    fetchEspnCoreJson<MatchcardsResponse>(`${compBase}/matchcards?pageSize=50`),
    fetchRecentBalls(compBase),
    fetchTeamSummaries(compBase),
  ]);

  if (!competition && !matchcards?.items?.length) return null;

  const cards = matchcards?.items ?? [];
  const battingCard = cards.find((c) => c.typeID === "11");
  const bowlingCard = cards.find((c) => c.typeID === "12");
  const partnershipCard = cards.find((c) => c.typeID === "13");

  const battingTeam = battingCard?.teamName ?? "";
  const currentTotals = parseInningsTotal(battingCard?.total, battingCard?.runs);
  const currentPeriod = Number(battingCard?.inningsNumber ?? recentBalls.at(-1)?.period ?? 1);
  const dismissalMap = await getDismissalMap(compBase, currentPeriod).catch(
    () => new Map<string, string>(),
  );

  const batting = mapBattingPlayers(battingCard?.playerDetails ?? [], dismissalMap);
  const bowling = mapBowlingPlayers(bowlingCard?.playerDetails ?? []);
  const atCrease = batting.filter((p) => /not out/i.test(p.dismissed ?? ""));
  const markedBatters = markStriker(atCrease, recentBalls);

  const orderedTeams = [
    ...teamSummaries.filter((t) => isBangladeshTeam(t.team)),
    ...teamSummaries.filter((t) => !isBangladeshTeam(t.team)),
  ];

  const innings: Scorecard["innings"] = orderedTeams.map((summary, index) => {
    const isCurrentBatting = summary.team === battingTeam;
    return {
      inning: `${summary.team} ${ordinalInnings(index + 1)} Innings`,
      runs: isCurrentBatting ? currentTotals.runs || summary.runs : summary.runs,
      wickets: isCurrentBatting ? currentTotals.wickets || summary.wickets : summary.wickets,
      overs: isCurrentBatting ? currentTotals.overs || summary.overs : summary.overs,
      batting: isCurrentBatting ? batting : [],
      bowling: isCurrentBatting ? [] : [],
    };
  });

  if (innings.length === 2 && battingTeam) {
    const chaseIdx = innings.findIndex((inn) => inn.inning.startsWith(battingTeam));
    if (chaseIdx >= 0) {
      innings[chaseIdx] = {
        ...innings[chaseIdx],
        batting,
        bowling,
        runs: currentTotals.runs || innings[chaseIdx].runs,
        wickets: currentTotals.wickets || innings[chaseIdx].wickets,
        overs: currentTotals.overs || innings[chaseIdx].overs,
      };
    }
  }

  if (!innings.length && battingCard) {
    innings.push({
      inning: `${battingTeam || "Team"} Innings`,
      runs: currentTotals.runs,
      wickets: currentTotals.wickets,
      overs: currentTotals.overs,
      batting,
      bowling,
    });
  }

  if (currentPeriod > 1 && innings[0] && !innings[0].batting.length) {
    try {
      const firstInnings = await aggregateInningsFromDetails(compBase, leagueId, 1);
      innings[0] = {
        ...innings[0],
        batting: firstInnings.batting,
        bowling: firstInnings.bowling,
      };
    } catch {
      // keep innings total only
    }
  }
  const periodBalls = recentBalls.filter((b) => b.period === currentPeriod);

  const scorecard: Scorecard = {
    id: matchId,
    name: competition?.shortDescription ?? competition?.description ?? "Bangladesh match",
    status: competition?.note ?? "Live",
    venue: competition?.venue?.fullName,
    teams: orderedTeams.map((t) => t.team),
    innings,
  };

  const liveFeed: LiveMatchFeed = {
    batters: markedBatters,
    bowlers: bowlersFromRecentBall(bowling, periodBalls),
    partnership: currentPartnership(partnershipCard?.playerDetails as PartnershipRow[] | undefined),
    lastWicket: lastWicketText(periodBalls, batting),
    recentOvers: groupRecentOvers(periodBalls),
  };

  const payload = { scorecard, liveFeed };
  centreCache.set(cacheKey, { at: Date.now(), data: payload });
  return payload;
}
