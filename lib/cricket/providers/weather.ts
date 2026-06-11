/**
 * Venue weather for the match centre — both APIs are free and keyless:
 * - Geocoding: Open-Meteo (fast)
 * - Forecast: MET Norway locationforecast (Open-Meteo's forecast API is too slow)
 */
const GEO_BASE = "https://geocoding-api.open-meteo.com/v1/search";
const MET_NO_BASE = "https://api.met.no/weatherapi/locationforecast/2.0/compact";
const MET_NO_USER_AGENT = "TigersDen/1.0 (Bangladesh cricket fan site)";

const WEATHER_CACHE_MS = 10 * 60 * 1000;
/** Failed lookups retry sooner than good results. */
const WEATHER_ERROR_CACHE_MS = 60 * 1000;

export type HourForecast = {
  /** Venue-local time, e.g. "15:00" */
  time: string;
  tempC: number;
  label: string;
  emoji: string;
  precipitationMm: number | null;
};

export type MatchWeather = {
  city: string;
  tempC: number;
  feelsLikeC: number | null;
  humidityPct: number | null;
  windKmh: number | null;
  precipitationMm: number | null;
  label: string;
  emoji: string;
  /** Next 6 hours at the venue. */
  hourly: HourForecast[];
};

type GeoResult = { lat: number; lon: number; timezone?: string };

const geocodeCache = new Map<string, GeoResult | null>();
const weatherCache = new Map<string, { at: number; weather: MatchWeather | null }>();

/** met.no symbol_code (e.g. "lightrainshowers_day") → label + emoji. */
function describeSymbol(symbolCode: string): { label: string; emoji: string } {
  const base = symbolCode.replace(/_(day|night|polartwilight)$/, "");

  if (base.includes("thunder")) return { label: "Thunderstorm", emoji: "⛈️" };
  if (base.includes("sleet")) return { label: "Sleet", emoji: "🌨️" };
  if (base.includes("snow")) return { label: "Snow", emoji: "❄️" };
  if (base.includes("heavyrain")) return { label: "Heavy rain", emoji: "🌧️" };
  if (base.includes("lightrain")) return { label: "Light rain", emoji: "🌦️" };
  if (base.includes("rain")) return { label: "Rain", emoji: "🌧️" };
  if (base === "fog") return { label: "Fog", emoji: "🌫️" };
  if (base === "cloudy") return { label: "Cloudy", emoji: "☁️" };
  if (base === "partlycloudy") return { label: "Partly cloudy", emoji: "⛅" };
  if (base === "fair") return { label: "Fair", emoji: "🌤️" };
  if (base === "clearsky") return { label: "Clear sky", emoji: "☀️" };
  return { label: "—", emoji: "🌡️" };
}

async function fetchJson<T>(url: string, headers: Record<string, string> = {}): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json", ...headers },
      signal: AbortSignal.timeout(12_000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function geocodeCity(city: string, country?: string): Promise<GeoResult | null> {
  const key = `${city}|${country ?? ""}`.toLowerCase();
  if (geocodeCache.has(key)) return geocodeCache.get(key) ?? null;

  const url = new URL(GEO_BASE);
  url.searchParams.set("name", city);
  url.searchParams.set("count", "5");
  url.searchParams.set("language", "en");

  const json = await fetchJson<{
    results?: {
      latitude: number;
      longitude: number;
      country?: string;
      timezone?: string;
    }[];
  }>(url.toString());

  const results = json?.results ?? [];
  const match =
    (country
      ? results.find((r) => r.country?.toLowerCase() === country.toLowerCase())
      : null) ?? results[0];

  const coords: GeoResult | null = match
    ? { lat: match.latitude, lon: match.longitude, timezone: match.timezone }
    : null;
  // Only negative-cache when the API answered — a timeout shouldn't stick forever.
  if (json) geocodeCache.set(key, coords);
  return coords;
}

function formatLocalHour(iso: string, timezone?: string): string {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: timezone || "UTC",
    }).format(new Date(iso));
  } catch {
    return iso.slice(11, 16);
  }
}

type MetNoTimestep = {
  time?: string;
  data?: {
    instant?: {
      details?: {
        air_temperature?: number;
        relative_humidity?: number;
        wind_speed?: number;
      };
    };
    next_1_hours?: {
      summary?: { symbol_code?: string };
      details?: { precipitation_amount?: number };
    };
  };
};

type MetNoResponse = {
  properties?: {
    timeseries?: MetNoTimestep[];
  };
};

function toHourForecast(step: MetNoTimestep, timezone?: string): HourForecast | null {
  const temp = step.data?.instant?.details?.air_temperature;
  const hour = step.data?.next_1_hours;
  if (!step.time || typeof temp !== "number" || !hour) return null;

  const { label, emoji } = describeSymbol(hour.summary?.symbol_code ?? "");
  return {
    time: formatLocalHour(step.time, timezone),
    tempC: Math.round(temp),
    label,
    emoji,
    precipitationMm: hour.details?.precipitation_amount ?? null,
  };
}

/** Current weather for a city — used for the live match venue. */
export async function getCityWeather(
  city: string,
  country?: string,
): Promise<MatchWeather | null> {
  const trimmed = city.trim();
  if (!trimmed) return null;

  const key = `${trimmed}|${country ?? ""}`.toLowerCase();
  const cached = weatherCache.get(key);
  if (cached) {
    const maxAge = cached.weather ? WEATHER_CACHE_MS : WEATHER_ERROR_CACHE_MS;
    if (Date.now() - cached.at < maxAge) return cached.weather;
  }

  const coords = await geocodeCity(trimmed, country);
  if (!coords) {
    weatherCache.set(key, { at: Date.now(), weather: null });
    return null;
  }

  const url = `${MET_NO_BASE}?lat=${coords.lat.toFixed(4)}&lon=${coords.lon.toFixed(4)}`;
  const json = await fetchJson<MetNoResponse>(url, { "User-Agent": MET_NO_USER_AGENT });

  const timeseries = json?.properties?.timeseries ?? [];
  const now = timeseries[0]?.data;
  const instant = now?.instant?.details;
  let weather: MatchWeather | null = null;

  if (instant && typeof instant.air_temperature === "number") {
    const symbol = now?.next_1_hours?.summary?.symbol_code ?? "";
    const { label, emoji } = describeSymbol(symbol);

    const hourly = timeseries
      .slice(1, 12)
      .map((step) => toHourForecast(step, coords.timezone))
      .filter((h): h is HourForecast => Boolean(h))
      .slice(0, 6);

    weather = {
      city: trimmed,
      tempC: Math.round(instant.air_temperature),
      feelsLikeC: null,
      humidityPct:
        typeof instant.relative_humidity === "number"
          ? Math.round(instant.relative_humidity)
          : null,
      windKmh:
        typeof instant.wind_speed === "number"
          ? Math.round(instant.wind_speed * 3.6)
          : null,
      precipitationMm: now?.next_1_hours?.details?.precipitation_amount ?? null,
      label,
      emoji,
      hourly,
    };
  }

  weatherCache.set(key, { at: Date.now(), weather });
  return weather;
}
