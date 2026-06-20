export type MatchCategory = "men" | "women" | "u19" | "emerging" | "domestic";

/** Display / sort priority — men's and women's internationals always lead. */
export function matchCategoryPriority(category: MatchCategory): number {
  switch (category) {
    case "men":
      return 1;
    case "women":
      return 2;
    case "u19":
      return 3;
    case "emerging":
      return 4;
    case "domestic":
      return 10;
    default:
      return 50;
  }
}

export function matchCategoryFromText(...parts: (string | undefined | null)[]): MatchCategory {
  const blob = parts.filter(Boolean).join(" ").toLowerCase();
  if (/\bu-?19\b|under[- ]?19/.test(blob)) return "u19";
  if (/\bemerging\b|\bacademy\b|\bbangladesh a\b/.test(blob)) return "emerging";
  if (/\bwomen\b/.test(blob)) return "women";
  return "men";
}

export function matchCategoryLabel(category: MatchCategory): string {
  switch (category) {
    case "men":
      return "Men";
    case "women":
      return "Women";
    case "u19":
      return "Under-19";
    case "emerging":
      return "Emerging";
    case "domestic":
      return "Domestic";
    default:
      return "Match";
  }
}
