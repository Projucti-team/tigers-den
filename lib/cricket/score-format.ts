/** "91/3 (18.4/50 ov, target 285)" → "91/3 (18)"; completed "284/8" stays "284/8". */
export function compactCricketScore(raw: string, inningsComplete = false): string {
  const base = raw.match(/^(\d+\/\d+)/)?.[1];
  if (!base) return raw.trim();

  if (inningsComplete || !/\d+\s*ov/i.test(raw)) return base;

  const overs = raw.match(/\((\d+(?:\.\d+)?)\s*(?:\/\d+)?\s*ov/i)?.[1];
  if (!overs) return base;

  const wholeOvers = overs.includes(".") ? overs.split(".")[0] : overs;
  return `${base} (${wholeOvers})`;
}
