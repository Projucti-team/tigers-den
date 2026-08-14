export type VenueGuide = {
  venueName: string;
  city: string;
  about: string;
  cityAbout: string;
  weather: string;
};

type VenueEntry = Omit<VenueGuide, "venueName"> & { patterns: RegExp[] };

const VENUE_ENTRIES: VenueEntry[] = [
  {
    patterns: [/shere bangla|mirpur/i],
    city: "Dhaka",
    about:
      "The Shere Bangla National Stadium in Mirpur is Bangladesh's largest cricket ground — a roaring bowl of green and red when the Tigers play at home.",
    cityAbout:
      "Dhaka is a vibrant megacity on the Buriganga, famous for street food, rickshaws, and passionate cricket crowds that turn every international into a festival.",
    weather:
      "Typical match months are warm and humid (28–35°C) with occasional thunderstorms in monsoon season; dry winter evenings are pleasant for night games.",
  },
  {
    patterns: [/zahur ahmed|chattogram|chittagong|matiur rahman/i],
    city: "Chattogram",
    about:
      "Zahur Ahmed Chowdhury Stadium sits near the Karnaphuli — a compact ground where the atmosphere builds quickly and boundaries fly in the evening light.",
    cityAbout:
      "Chattogram is Bangladesh's port city, blending hills, beaches, and a laid-back coastal vibe — perfect for a tour stop between Dhaka and Sylhet.",
    weather:
      "Coastal humidity is noticeable year-round; expect 27–33°C with sea breeze, and heavier rain during the June–September monsoon.",
  },
  {
    patterns: [/sylhet international|sylhet/i],
    city: "Sylhet",
    about:
      "Sylhet International Cricket Stadium is one of the newer jewels in Bangladesh cricket — scenic, modern, and loved for T20 fireworks under lights.",
    cityAbout:
      "Sylhet is the tea-country capital of Bangladesh, surrounded by rolling hills and lush estates — a cooler, greener escape for players and fans.",
    weather:
      "Slightly cooler than the lowlands (24–32°C); monsoon brings lush rain while winter months are mild and comfortable for evening cricket.",
  },
  {
    patterns: [/lords|lord's/i],
    city: "London",
    about:
      "Lord's — the Home of Cricket — is a historic ground where Bangladesh fans travel in huge numbers for that once-in-a-lifetime Test experience.",
    cityAbout:
      "London needs little introduction: museums, pubs, and a global Bangladeshi diaspora make match week feel like a home away from home.",
    weather:
      "UK summer (May–August) is mild (15–24°C) with changeable skies — pack a light jacket; rain delays are always possible.",
  },
  {
    // Deliberately not a bare /oval/i -- plenty of grounds worldwide have "Oval" in their name
    // (Marrara Oval in Darwin, Adelaide Oval, Queen's Park Oval, Kensington Oval), and a bare
    // match here silently overwrote all of them with Kia Oval/London's guide content.
    patterns: [/kia oval|the oval,?\s*london|kennington/i],
    city: "London",
    about:
      "The Kia Oval is a classic London venue known for dramatic Tests and one-day thrillers, with a lively crowd and famous pavilion.",
    cityAbout:
      "South London offers great transport links and plenty to explore before and after the match — a favourite for touring Tigers' Den groups.",
    weather:
      "Similar to Lord's: temperate summer, occasional showers, and long daylight hours for day-night formats.",
  },
  {
    patterns: [/melbourne cricket ground|mcg/i],
    city: "Melbourne",
    about:
      "The MCG is one of the world's great arenas — vast, loud, and unforgettable when Bangladesh take on Australia in front of a packed house.",
    cityAbout:
      "Melbourne is Australia's sporting capital: coffee culture, laneways, and a huge multicultural fan base make it a brilliant tour city.",
    weather:
      "Southern summer (Dec–Feb) is warm (20–30°C) but can swing cool after sunset; sun protection is essential for day games.",
  },
  {
    patterns: [/sydney cricket ground|scg/i],
    city: "Sydney",
    about:
      "The SCG is a picturesque ground with a rich history — spin-friendly pitches and a famous Members' area for classic Test cricket.",
    cityAbout:
      "Sydney pairs harbour views with world-class food; many fans extend their trip to combine the match with beaches and the Blue Mountains.",
    weather:
      "Humid summers (22–32°C) with afternoon storms possible; evening sea breeze often cools T20 nights.",
  },
  {
    patterns: [/marrara/i],
    city: "Darwin",
    about:
      "Marrara Oval (Marrara Cricket Ground) hosted Bangladesh's first-ever Test on Australian soil — a tropical outfield with a small-ground buzz and a fast-growing local following.",
    cityAbout:
      "Darwin is Australia's tropical northern capital — harbourside sunsets, a laid-back pace, and a warm welcome for touring Tigers' Den fans.",
    weather:
      "Darwin's dry season (May–October) is warm and largely rain-free (20–33°C) — good touring weather, though humidity builds toward the wet season.",
  },
  {
    patterns: [/kensington oval|barbados/i],
    city: "Bridgetown, Barbados",
    about:
      "Kensington Oval is Caribbean cricket royalty — fast outfield, carnival atmosphere, and unforgettable T20 nights in the West Indies.",
    cityAbout:
      "Barbados blends cricket, calypso, and beaches — a bucket-list destination for Bangladesh fans on a Tigers' Den away tour.",
    weather:
      "Tropical year-round (26–32°C); brief tropical showers are common but rarely stop play for long.",
  },
];

function monthFromDate(iso?: string): number {
  if (!iso) return new Date().getMonth() + 1;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? new Date().getMonth() + 1 : d.getMonth() + 1;
}

/** True when venueRaw matches one of our hand-written VENUE_ENTRIES templates (deterministic, code-controlled — never worth trusting a cached copy over). */
export function isCuratedVenue(venueRaw: string): boolean {
  const venueName = venueRaw.trim();
  return VENUE_ENTRIES.some((e) => e.patterns.some((p) => p.test(venueName)));
}

export function lookupVenueGuide(venueRaw: string, matchDate?: string): VenueGuide {
  const venueName = venueRaw.trim() || "Venue TBC";
  const entry = VENUE_ENTRIES.find((e) => e.patterns.some((p) => p.test(venueName)));

  if (entry) {
    return {
      venueName,
      city: entry.city,
      about: entry.about,
      cityAbout: entry.cityAbout,
      weather: entry.weather,
    };
  }

  const city = venueName.split(",")[0]?.trim() || "Host city";
  const month = monthFromDate(matchDate);

  return {
    venueName,
    city,
    about: `${venueName} hosts this fixture — check local travel advice and arrive early on match day for the best Tigers' Den atmosphere.`,
    cityAbout: `Explore ${city} around match day — local fans, food, and culture make every away series memorable.`,
    weather: genericWeather(month),
  };
}

function genericWeather(month: number): string {
  if (month >= 6 && month <= 9) {
    return "Monsoon-influenced conditions are possible in South Asia — warm, humid, and watch for rain interruptions.";
  }
  if (month >= 11 || month <= 2) {
    return "Generally dry and pleasant in the subcontinent; cooler evenings possible in December–January.";
  }
  return "Check the forecast closer to match day — conditions vary by region and time of year.";
}

export function uniqueVenuesFromMatches(
  matches: { venue?: string; date?: string }[],
): VenueGuide[] {
  const seen = new Set<string>();
  const guides: VenueGuide[] = [];

  for (const m of matches) {
    if (!m.venue) continue;
    const key = m.venue.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    guides.push(lookupVenueGuide(m.venue, m.date));
  }

  return guides;
}

type ResolveTourVenuesOptions = {
  /** Guides already saved on this tour — reused instead of regenerating. */
  cached?: VenueGuide[];
  /** Save newly generated guides to the venue-guides store (sync jobs only). */
  persist?: boolean;
};

/** Resolve venue guides from tour cache, DB/JSON store, or templates — generate at most once per ground. */
export async function resolveTourVenues(
  matches: { venue?: string; date?: string }[],
  options: ResolveTourVenuesOptions = {},
): Promise<VenueGuide[]> {
  const { readVenueGuidesSnapshot, upsertVenueGuides, venueGuideKey } = await import(
    "@/lib/cricket/venue-guides-store"
  );

  const store = await readVenueGuidesSnapshot();
  const cachedByKey = new Map(
    (options.cached ?? []).map((guide) => [venueGuideKey(guide.venueName), guide]),
  );
  const seen = new Set<string>();
  const guides: VenueGuide[] = [];
  const toPersist: VenueGuide[] = [];

  for (const match of matches) {
    if (!match.venue) continue;
    const key = venueGuideKey(match.venue);
    if (seen.has(key)) continue;
    seen.add(key);

    const cached = cachedByKey.get(key);
    const stored = store.entries[key];
    // Curated venues (VENUE_ENTRIES) are deterministic, code-controlled templates -- always
    // recompute rather than trust a cached/stored copy. A stale cached guide is how the
    // Marrara Oval / Kia Oval collision survived fixing the regex that caused it: the wrong
    // guide had already been persisted, so `stored` kept winning over the corrected template
    // on every later sync. Non-curated (generic fallback) venues still prefer cache/store, since
    // there's no "correct" template to fall back to for those.
    let guide = isCuratedVenue(match.venue)
      ? lookupVenueGuide(match.venue, match.date)
      : (cached ?? stored ?? lookupVenueGuide(match.venue, match.date));

    const venueName = match.venue.trim();
    if (guide.venueName !== venueName) {
      guide = { ...guide, venueName };
    }

    guides.push(guide);

    // Also re-persist curated venues even when already stored, so a stale/wrong cached copy
    // (like the Marrara/Kia Oval collision) gets corrected in the store instead of just being
    // bypassed at read time. upsertVenueGuides() is itself a no-op if the content is unchanged.
    if (options.persist && (!stored || isCuratedVenue(match.venue))) {
      toPersist.push(guide);
    }
  }

  if (options.persist && toPersist.length) {
    await upsertVenueGuides(toPersist);
  }

  return guides;
}
