import { existsSync } from "node:fs";

import { OPPONENT_NATIONS } from "@/lib/cricket/tour-identity";
import { mergeSquads, type SeriesSquad, type SquadPlayer } from "@/lib/cricket/squads/types";

/**
 * ESPNcricinfo's squads pages (both the legacy `/ci/content/squad/index.html?object=` link
 * and the modern `/series/.../squads` pages) are rendered client-side -- a plain HTTP fetch
 * only gets the empty page shell, which is why fetchSquadsFromEspnCore() and
 * fetchSquadsFromLegacySeriesSquadsPage() come back empty even once the page is genuinely
 * populated. This module drives a real (headless) browser so the page's own JavaScript runs
 * and fills in the roster before we read it.
 *
 * The squad roster itself lives inside an <iframe>, not the top-level document -- confirmed
 * by inspecting the live page: document.body on the outer page is just two empty
 * accessibility announcer divs, while the visible player cards render elsewhere. We read
 * every frame's text, not just the main one.
 *
 * We deliberately don't use Playwright's own bundled browser download (the `playwright`
 * package) -- it doesn't ship musl/Alpine builds, and this repo's Docker image is
 * node:22-alpine. Instead we use `playwright-core` (no bundled browser, no postinstall
 * download) and point it at Alpine's system `chromium` package, installed in the Dockerfile.
 * Locally (non-Alpine dev machines) this will only work if a compatible Chromium binary is
 * discoverable -- see CHROMIUM_CANDIDATE_PATHS. If none is found, callers get an empty
 * result rather than a crash; other squad sources still apply.
 */

const CHROMIUM_CANDIDATE_PATHS = [
  process.env.CHROMIUM_EXECUTABLE_PATH,
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
  "/usr/lib/chromium/chromium",
  "/usr/bin/google-chrome",
].filter((p): p is string => Boolean(p));

let cachedExecutablePath: string | null | undefined; // undefined = not checked yet

function resolveChromiumExecutablePath(): string | null {
  if (cachedExecutablePath !== undefined) return cachedExecutablePath;

  for (const candidate of CHROMIUM_CANDIDATE_PATHS) {
    try {
      if (existsSync(candidate)) {
        cachedExecutablePath = candidate;
        console.log(`[cricket] espn-squads-browser: using Chromium at ${candidate}`);
        return cachedExecutablePath;
      }
    } catch {
      // keep trying other candidates
    }
  }

  console.log(
    `[cricket] espn-squads-browser: no Chromium binary found (checked: ${CHROMIUM_CANDIDATE_PATHS.join(", ") || "none configured"}) -- headless squad scrape skipped`,
  );
  cachedExecutablePath = null;
  return null;
}

const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function isHeaderLine(line: string): string | null {
  if (line.length > 70) return null;
  const lower = line.toLowerCase();
  for (const nation of OPPONENT_NATIONS) {
    if (lower === nation || lower.startsWith(`${nation} `) || lower.startsWith(`${nation}'s `)) {
      return line;
    }
  }
  return null;
}

/** Site-chrome words that show up as short standalone lines but are never player names. */
const NON_PLAYER_LINES =
  /^(squads?|full squads?|series squads?|test squad|odi squad|t20i? squad|home|away|live scores?|schedule|fixtures|results|news|videos|photos|rankings|table of contents|share|follow|advertisement|player|players|captain|vice-captain|wicketkeeper|batter|bowler|all-?rounder|coach|more|read more|see all)$/i;

const NAME_LINE = /^[A-Z][A-Za-z'.-]*(?:\s+[A-Z][A-Za-z'.-]*){1,4}(?:\s*\([^)]{1,25}\))?$/;

function isPlayerNameLine(line: string): boolean {
  if (line.length > 45) return false;
  if (NON_PLAYER_LINES.test(line)) return false;
  if (isHeaderLine(line)) return false;
  return NAME_LINE.test(line);
}

/** Fallback heuristic for pages that use a plain "<Nation> heading, then a run of names" shape. */
function parseSquadsGeneric(lines: string[], source: string): SeriesSquad[] {
  const squads: SeriesSquad[] = [];
  let currentHeader: string | null = null;
  let currentPlayers: SquadPlayer[] = [];

  const flush = () => {
    if (currentHeader && currentPlayers.length >= 8) {
      squads.push({ team: currentHeader, players: currentPlayers, source });
    }
    currentPlayers = [];
  };

  for (const line of lines) {
    const header = isHeaderLine(line);
    if (header) {
      flush();
      currentHeader = header;
      continue;
    }
    if (currentHeader && isPlayerNameLine(line)) {
      currentPlayers.push({ name: line });
    }
  }
  flush();

  return squads;
}

/**
 * ESPN's squad-card layout repeats, per player:
 *   <Name> [+]
 *   <Role descriptor, e.g. "Wicketkeeper Batter" or "Top order Batter">
 *   Age: <age>
 *   Batting: <style>
 *   [Bowling: <style>]
 * "Age: ..." is a highly reliable, unambiguous anchor unique to player cards (nothing else on
 * the page reads that way), so instead of guessing at name-shaped lines directly -- which
 * false-positives on role descriptors like "Wicketkeeper Batter", themselves two capitalized
 * words -- walk backward from every "Age:" line to find the name two lines above it.
 */
// The confirmed real title format is "<Team> <Tour name> Squad" (e.g. "Australia Bangladesh
// tour of Australia 2026 Squad") -- always ends with the word "Squad". Breadcrumb trails
// rendered nearby (e.g. "Bangladesh tour of Australia 2026") can also start with a nation
// name but never end with "Squad", so require both to avoid picking a breadcrumb fragment
// as the team label. Also return just the matched nation, not the raw title -- the raw
// title names *both* teams (the tour name includes the opponent), and squadPrimaryNation()
// matches "bangladesh" before "australia", so "Australia Bangladesh tour of Australia 2026
// Squad" as a label would get this whole roster misfiled as Bangladesh's squad.
function isCardPageHeaderLine(line: string): string | null {
  if (!/\bsquad$/i.test(line)) return null;
  const lower = line.toLowerCase();
  for (const nation of OPPONENT_NATIONS) {
    if (lower === nation || lower.startsWith(`${nation} `) || lower.startsWith(`${nation}'s `)) {
      return nation.replace(/\b\w/g, (c) => c.toUpperCase());
    }
  }
  return null;
}

function parseSquadsFromPlayerCards(lines: string[], source: string): SeriesSquad[] {
  const AGE_LINE = /^age:/i;
  const candidates: { index: number; name: string }[] = [];

  for (let i = 0; i < lines.length; i++) {
    if (!AGE_LINE.test(lines[i])) continue;
    const nameLine = lines[i - 2];
    if (!nameLine) continue;
    const name = nameLine.replace(/\s*\+\s*$/, "").trim();
    if (name.length >= 2 && name.length <= 45 && /^[A-Z]/.test(name) && !isHeaderLine(name)) {
      candidates.push({ index: i - 2, name });
    }
  }

  if (!candidates.length) return [];

  const headers = lines
    .map((line, index) => ({ index, label: isCardPageHeaderLine(line) }))
    .filter((h): h is { index: number; label: string } => Boolean(h.label));

  if (!headers.length) {
    return candidates.length >= 8
      ? [{ team: "Squad", players: candidates.map((c) => ({ name: c.name })), source }]
      : [];
  }

  const squads: SeriesSquad[] = [];
  for (let h = 0; h < headers.length; h++) {
    const start = headers[h].index;
    const end = h + 1 < headers.length ? headers[h + 1].index : lines.length;
    const players = candidates
      .filter((c) => c.index > start && c.index < end)
      .map((c) => ({ name: c.name }));
    if (players.length >= 8) {
      squads.push({ team: headers[h].label, players, source });
    }
  }
  return squads;
}

export function parseSquadsFromRenderedText(text: string, source: string): SeriesSquad[] {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const squads = parseSquadsFromPlayerCards(lines, source);
  if (squads.length) return squads;

  const fallback = parseSquadsGeneric(lines, source);
  if (fallback.length) return fallback;

  // Full dump, not a truncated preview -- a short preview isn't enough to tell "the roster
  // never loaded" apart from "the roster loaded and the parser missed it," and guessing
  // between those two blind wastes a whole deploy-and-wait cycle.
  console.log(
    `[cricket] espn-squads-browser: parsed 0 squads from ${lines.length} line(s) at ${source} -- ` +
      `full text: ${JSON.stringify(lines)}`,
  );
  return [];
}

/** Read every frame on the page (the squad roster lives in an iframe, not the top document). */
async function collectFrameTexts(
  page: import("playwright-core").Page,
): Promise<{ url: string; text: string }[]> {
  const results: { url: string; text: string }[] = [];
  for (const frame of page.frames()) {
    try {
      const text = await frame.evaluate(() => document.body?.innerText ?? "");
      if (text.trim()) results.push({ url: frame.url(), text });
    } catch {
      // cross-origin or already-detached frame -- skip
    }
  }
  return results;
}

function parseAllFrames(frames: { url: string; text: string }[]): SeriesSquad[] {
  const perFrame = frames.map(({ url, text }) => parseSquadsFromRenderedText(text, url));
  const nonEmpty = perFrame.filter((s) => s.length);
  return nonEmpty.length ? mergeSquads(...nonEmpty) : [];
}

/** Render a client-side ESPN squads page with a real browser and parse the visible text. */
export async function fetchSquadsViaHeadlessBrowser(url: string): Promise<SeriesSquad[]> {
  const executablePath = resolveChromiumExecutablePath();
  if (!executablePath) return [];

  let chromium: typeof import("playwright-core").chromium;
  try {
    ({ chromium } = await import("playwright-core"));
  } catch (err) {
    console.log(`[cricket] espn-squads-browser: playwright-core unavailable: ${String(err)}`);
    return [];
  }

  const browser = await chromium
    .launch({
      executablePath,
      headless: true,
      args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
    })
    .catch((err) => {
      console.log(`[cricket] espn-squads-browser: launch failed: ${String(err)}`);
      return null;
    });
  if (!browser) return [];

  try {
    const page = await browser.newPage({ userAgent: BROWSER_USER_AGENT });
    page.setDefaultTimeout(20_000);

    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 20_000 });
    } catch {
      // Fall through and read whatever rendered within the timeout -- partial content is
      // still better than nothing, and networkidle can legitimately never fire on pages
      // with long-poll/analytics connections.
    }
    console.log(`[cricket] espn-squads-browser: landed on ${page.url()} (requested ${url})`);

    // A "get notified" newsletter popup covers the page on first load and intercepts clicks
    // (shows up as Playwright's "subtree intercepts pointer events" retry loop) -- dismiss it
    // before trying to interact with anything else. Best-effort: if it's not there, or the
    // button text/structure has changed, just move on.
    try {
      await page
        .getByRole("button", { name: /not now/i })
        .first()
        .click({ timeout: 3_000 });
      console.log("[cricket] espn-squads-browser: dismissed newsletter popup");
    } catch {
      await page.keyboard.press("Escape").catch(() => {});
    }

    // Some series redirect straight to the real squads URL already; others land on the
    // generic overview tab (Home / Fixtures and Results / Teams / ...) and need one more
    // client-side navigation to reach the roster, behind whichever tab is labelled "Squads"
    // or "Teams". Only bother clicking through when we're not already there.
    let frames = await collectFrameTexts(page);
    let squads = parseAllFrames(frames);

    if (!squads.length && !/squads?$/i.test(page.url())) {
      for (const label of ["Squads", "Teams"]) {
        try {
          // `.last()` because the same label usually also appears once in the site's global
          // top nav, which we don't want -- the series-specific sub-nav renders later in the DOM.
          const link = page.getByRole("link", { name: label, exact: true }).last();
          if ((await link.count()) === 0) continue;
          await link.click({ timeout: 5_000 });
          await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
          console.log(`[cricket] espn-squads-browser: clicked "${label}" tab -> ${page.url()}`);
          frames = await collectFrameTexts(page);
          squads = parseAllFrames(frames);
          if (squads.length) break;
        } catch (err) {
          console.log(`[cricket] espn-squads-browser: click "${label}" failed: ${String(err)}`);
        }
      }
    }

    // Still nothing? The roster may only render once scrolled into view. Scroll to the
    // bottom, give it a moment, and re-read every frame before giving up.
    if (!squads.length) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => {});
      await page.waitForTimeout(2_000);
      const scrolledFrames = await collectFrameTexts(page);
      const scrolledChars = scrolledFrames.reduce((n, f) => n + f.text.length, 0);
      const beforeChars = frames.reduce((n, f) => n + f.text.length, 0);
      if (scrolledChars !== beforeChars) {
        console.log(
          `[cricket] espn-squads-browser: text changed after scroll (${beforeChars} -> ${scrolledChars} chars across ${scrolledFrames.length} frame(s)), re-parsing`,
        );
        frames = scrolledFrames;
        squads = parseAllFrames(frames);
      }
    }

    console.log(
      `[cricket] espn-squads-browser: rendered ${page.url()} -> ${frames.length} frame(s), ` +
        `${frames.reduce((n, f) => n + f.text.length, 0)} total char(s), ${squads.length} squad(s) found`,
    );
    return squads;
  } catch (err) {
    console.log(`[cricket] espn-squads-browser: scrape failed for ${url}: ${String(err)}`);
    return [];
  } finally {
    await browser.close().catch(() => {});
  }
}
