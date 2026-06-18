/** Individual cricket sync steps — composable from admin, cron, or bootstrap. */
export const CRICKET_SYNC_JOB_IDS = [
  "players",
  "icc",
  "wtc",
  "rankings",
  "last-match",
  "upcoming",
  "tours",
] as const;

export type CricketSyncJobId = (typeof CRICKET_SYNC_JOB_IDS)[number];

export type CricketSyncJobSelection = CricketSyncJobId | "all";

export const CRICKET_SYNC_JOBS: {
  id: CricketSyncJobSelection;
  label: string;
  description: string;
}[] = [
  {
    id: "all",
    label: "Run all",
    description: "Full nightly sync — rankings, tours, squads, and match snapshots (~1–3 min).",
  },
  {
    id: "players",
    label: "Player registry",
    description: "Seed countries and repair broken player profile URLs in Postgres.",
  },
  {
    id: "icc",
    label: "ICC rankings JSON",
    description: "Refresh data/icc-rankings.json from the ICC Sportz feed.",
  },
  {
    id: "wtc",
    label: "WTC standings JSON",
    description: "Refresh data/wtc-standings.json from ESPNcricinfo.",
  },
  {
    id: "rankings",
    label: "Rankings page",
    description: "Rebuild the /rankings showcase snapshot in the database.",
  },
  {
    id: "last-match",
    label: "Last Bangladesh match",
    description: "Update the Bangladesh last completed match snapshot (ESPNcricinfo).",
  },
  {
    id: "upcoming",
    label: "Upcoming Bangladesh matches",
    description: "Update the upcoming Bangladesh fixtures snapshot (ESPNcricinfo).",
  },
  {
    id: "tours",
    label: "Tours & fixtures",
    description: "Rebuild /tours index and per-tour detail pages (CricAPI + ESPN).",
  },
];

function isJobId(value: string): value is CricketSyncJobId {
  return (CRICKET_SYNC_JOB_IDS as readonly string[]).includes(value);
}

/** Parse `?job=rankings` or `?jobs=icc,wtc,rankings` from admin/cron requests. */
export function parseCricketSyncJobs(
  input: string | null | undefined,
): CricketSyncJobSelection[] {
  if (!input?.trim()) return ["all"];

  const parts = input
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);

  if (parts.includes("all")) return ["all"];

  const jobs = parts.filter(isJobId);
  return jobs.length ? jobs : ["all"];
}

export function resolveCricketSyncJobs(
  selection: CricketSyncJobSelection[] | undefined,
): CricketSyncJobId[] {
  if (!selection?.length || selection.includes("all")) {
    return [...CRICKET_SYNC_JOB_IDS];
  }
  return selection.filter((job): job is CricketSyncJobId => job !== "all");
}
