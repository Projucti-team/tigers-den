function decodeDismissalEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&dagger;|&#8224;/gi, "†")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** "Saif Hassan c Labuschagne b Ellis 5 (5b…)" → "c Labuschagne b Ellis" */
export function parseEspnDismissalText(text: string): string {
  let clean = decodeDismissalEntities(text.replace(/<[^>]+>/g, "").trim());
  clean = clean.replace(/\s+\d+\s*\([^)]*\)(?:\s+SR:\s*[\d.]+)?$/i, "").trim();

  if (/^not out$/i.test(clean)) return "not out";

  const lower = clean.toLowerCase();
  const markers = [" c & b ", " c †", " c ", " lbw ", " st ", " run out", " retired", " b "];

  for (const marker of markers) {
    const idx = lower.indexOf(marker);
    if (idx > 0) {
      return decodeDismissalEntities(clean.slice(idx + 1).trim());
    }
  }

  if (/^(c|lbw|st|run out|retired|b)\b/i.test(clean)) return clean;

  return clean;
}

/** Fallback when only a short ESPN matchcard label is available. */
export function formatShortDismissal(raw: string): string {
  const d = raw.trim().toLowerCase();
  if (!d || d === "not out") return "not out";
  if (d === "caught wk" || d === "caught wicketkeeper") return "c † b";
  if (d === "caught") return "caught";
  if (d === "bowled") return "b";
  if (d === "lbw") return "lbw b";
  if (d === "stumped") return "st b";
  if (d === "run out") return "run out";
  return raw;
}
