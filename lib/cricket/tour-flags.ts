/** ISO 3166-1 alpha-2 codes for flagcdn.com */
const COUNTRY_BY_KEY: { keys: string[]; iso: string }[] = [
  { keys: ["west indies", "caribbean"], iso: "bb" },
  { keys: ["south africa"], iso: "za" },
  { keys: ["sri lanka"], iso: "lk" },
  { keys: ["new zealand"], iso: "nz" },
  { keys: ["bangladesh"], iso: "bd" },
  { keys: ["australia"], iso: "au" },
  { keys: ["england"], iso: "gb" },
  { keys: ["pakistan"], iso: "pk" },
  { keys: ["zimbabwe"], iso: "zw" },
  { keys: ["afghanistan"], iso: "af" },
  { keys: ["ireland"], iso: "ie" },
  { keys: ["india"], iso: "in" },
  { keys: ["scotland"], iso: "gb" },
  { keys: ["wales"], iso: "gb" },
];

export const BANGLADESH_FLAG_ISO = "bd";

/** flagcdn only serves certain widths (e.g. w240 returns 404). */
const FLAGCDN_WIDTHS = [80, 160, 320, 640] as const;

export function flagImageUrl(iso: string, minWidth = 160): string {
  const code = iso.toLowerCase();
  const w =
    FLAGCDN_WIDTHS.find((size) => size >= minWidth) ??
    FLAGCDN_WIDTHS[FLAGCDN_WIDTHS.length - 1];
  return `https://flagcdn.com/w${w}/${code}.png`;
}

/** Regional-indicator emoji flag (always works offline). */
export function flagEmoji(iso: string): string {
  const code = iso.toLowerCase();
  if (code.length !== 2) return "🏏";
  const toRegional = (char: string) => 0x1f1e6 - 97 + char.charCodeAt(0);
  return String.fromCodePoint(toRegional(code[0]), toRegional(code[1]));
}

const ISO_LABELS: Record<string, string> = {
  au: "Australia",
  bd: "Bangladesh",
  gb: "England",
  in: "India",
  pk: "Pakistan",
  lk: "Sri Lanka",
  za: "South Africa",
  nz: "New Zealand",
  zw: "Zimbabwe",
  ie: "Ireland",
  af: "Afghanistan",
  bb: "West Indies",
};

export function flagLabel(iso: string): string {
  return ISO_LABELS[iso.toLowerCase()] ?? iso.toUpperCase();
}

export function countryIsoFromText(text: string): string | null {
  const n = text.toLowerCase();
  for (const { keys, iso } of COUNTRY_BY_KEY) {
    if (keys.some((key) => n.includes(key))) return iso;
  }
  return null;
}

/** Opponent or host nation for a series title. */
export function opponentIsoFromTourName(tourName: string, isHomeSeries: boolean): string {
  const n = tourName.toLowerCase();

  if (isHomeSeries) {
    const hosted = n.match(/^(.+?)\s+tour\s+of\s+bangladesh/);
    if (hosted?.[1]) {
      const iso = countryIsoFromText(hosted[1]);
      if (iso && iso !== BANGLADESH_FLAG_ISO) return iso;
    }
    const inBd = n.match(/(.+?)\s+in\s+bangladesh/);
    if (inBd?.[1]) {
      const iso = countryIsoFromText(inBd[1]);
      if (iso && iso !== BANGLADESH_FLAG_ISO) return iso;
    }
  } else {
    const away = n.match(/bangladesh\s+tour\s+of\s+(.+?)(?:\s*,|\s+\d{4}|$)/);
    if (away?.[1]) {
      const iso = countryIsoFromText(away[1]);
      if (iso) return iso;
    }
  }

  const fallback = countryIsoFromText(tourName);
  if (fallback && fallback !== BANGLADESH_FLAG_ISO) return fallback;

  return BANGLADESH_FLAG_ISO;
}

/** Flag for the nation Bangladesh is playing (opponent at home, host away). */
export function tourFlagIsos(tourName: string, isHomeSeries: boolean): { headerIso: string } {
  return { headerIso: opponentIsoFromTourName(tourName, isHomeSeries) };
}
