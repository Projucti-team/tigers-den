import type { SeriesSquad, SquadPlayer } from "@/lib/cricket/squads/types";

const CAPTAIN_TOKENS = /^(c|capt|captain)$/i;
const WICKETKEEPER_TOKENS = /^(wk|wk\.|keeper|wicketkeeper|wicket-keeper|wicket keeper)$/i;

/**
 * Pulls every "(...)" group off a name and classifies each one. Handles a single combined
 * group ("Litton Das (c/wk)"), several separate groups ("Alex Carey (wk) (vc)"), and ignores
 * anything that isn't a captain/keeper marker (e.g. a nickname in parens) by leaving it in the
 * cleaned name rather than silently dropping it.
 */
function stripRoleMarkers(rawEntry: string): { name: string; isCaptain: boolean; isWicketKeeper: boolean } {
  let isCaptain = false;
  let isWicketKeeper = false;
  let name = rawEntry;

  name = name.replace(/\(([^)]*)\)/g, (whole, inner: string) => {
    const tokens = inner
      .split(/[\/,&+]/)
      .map((t) => t.trim())
      .filter(Boolean);

    if (tokens.length === 0) return "";

    const recognized = tokens.map((t) => {
      if (CAPTAIN_TOKENS.test(t)) {
        isCaptain = true;
        return true;
      }
      if (WICKETKEEPER_TOKENS.test(t)) {
        isWicketKeeper = true;
        return true;
      }
      return false;
    });

    // Every token in this group was a role marker -- drop the whole "(...)" group. If some
    // token wasn't recognized (e.g. a real nickname), keep the original text as-is so we don't
    // destroy information we don't understand.
    return recognized.every(Boolean) ? "" : whole;
  });

  return { name: name.replace(/\s+/g, " ").trim(), isCaptain, isWicketKeeper };
}

function parsePlayerList(raw: string): SquadPlayer[] {
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const { name, isCaptain, isWicketKeeper } = stripRoleMarkers(entry);
      if (!name) return null;
      const player: SquadPlayer = { name };
      if (isCaptain) player.isCaptain = true;
      if (isWicketKeeper) player.isWicketKeeper = true;
      return player;
    })
    .filter((p): p is SquadPlayer => Boolean(p));
}

/**
 * Parses admin-pasted squad text. Format: one team per block, a "Team Name:" header followed
 * by a comma-separated player list (either on the same line or continuing on the lines below,
 * up until the next "Team Name:" header or the end of the text). Player names carry role
 * markers in parentheses -- (c)/(capt)/(captain) for captain, (wk)/(keeper)/(wicketkeeper) for
 * wicketkeeper, combinable as (c/wk) -- anything else in parentheses is left alone.
 *
 * Example:
 *   Australia Test squad: Pat Cummins (c), Scott Boland, Alex Carey (wk), Cameron Green
 *   Bangladesh Test squad: Najmul Hossain Shanto (c), Mushfiqur Rahim (wk), Shadman Islam
 */
export function parseManualSquadText(text: string): SeriesSquad[] {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const squads: SeriesSquad[] = [];
  let currentTeam: string | null = null;
  let currentLines: string[] = [];

  function flush() {
    if (!currentTeam) return;
    const players = parsePlayerList(currentLines.join(", "));
    if (players.length) {
      squads.push({ team: currentTeam, players, source: "manual-admin-entry" });
    }
  }

  // A header line is "Label: rest" where the label is short (a team/format name, not itself a
  // run of comma-separated player names that happens to contain a colon somewhere unlikely).
  const headerPattern = /^([^:]{2,60}):\s*(.*)$/;

  for (const line of lines) {
    const match = line.match(headerPattern);
    if (match) {
      flush();
      currentTeam = match[1].trim();
      currentLines = match[2] ? [match[2]] : [];
    } else if (currentTeam) {
      currentLines.push(line);
    }
    // Lines before any header are ignored -- there's no team to attach them to.
  }
  flush();

  return squads;
}
