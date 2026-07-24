import { existsSync } from "node:fs";

import { OPPONENT_NATIONS } from "@/lib/cricket/tour-identity";
import type { SeriesSquad, SquadPlayer } from "@/lib/cricket/squads/types";

/**
 * ESPNcricinfo's squads pages (both the legacy `/ci/content/squad/index.html?object=` link
 * and the modern `/series/.../series-squads` pages) are rendered client-side -- a plain HTTP
 * fetch only gets the empty page shell, which is why fetchSquadsFromEspnCore() and
 * fetchSquadsFromLegacySeriesSquadsPage() come back empty even once the page is genuinely
 * populated. This module drives a real (headless) browser so the page's own JavaScript runs
 * and fills in the roster before we read it.
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

/** Site-chrome words that show up as short standalone lines but are never player names. */
const NON_PLAYER_LINES =
  /^(squads?|full squads?|series squads?|test squad|odi squad|t20i? squad|home|away|live scores?|schedule|fixtures|results|news|videos|photos|rankings|table of contents|share|follow|advertisement|player|players|captain|vice-captain|wicketkeeper|batter|bowler|all-?rounder|coach|more|read more|see all)$/i;

const NAME_LINE = /^[A-Z][A-Za-z'.-]*(?:\s+[A-Z][A-Za-z'.-]*){1,4}(?:\s*\([^)]{1,25}\))?$/;

function isHeaderLine(line: string): string | null {
  if (line.length > 60) return null;
  const lower = line.toLowerCase();
  for (const nation of OPPONENT_NATIONS) {
    if (lower === nation || lower.startsWith(`${nation} `) || lower.startsWith(`${nation}'s `)) {
      return line;
    }
  }
  return null;
}

function isPlayerNameLine(line: string): boolean {
  if (line.length > 45) return false;
  if (NON_PLAYER_LINES.test(line)) return false;
  if (isHeaderLine(line)) return false;
  return NAME_LINE.test(line);
}

/**
 * Generic text-based squad parser for rendered page text. Deliberately doesn't rely on CSS
 * selectors/DOM structure (which we can't verify without being able to inspect the live
 * rendered page from this environment) -- instead scans for short "<Nation>[, Squad]" header
 * lines followed by a run of name-shaped lines, the same heuristic shape as
 * parseSquadsFromStoryHtml uses for story articles.
 */
export function parseSquadsFromRenderedText(text: string, source: string): SeriesSquad[] {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

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

  if (!squads.length) {
    console.log(
      `[cricket] espn-squads-browser: parsed 0 squads from ${lines.length} rendered text line(s) -- ` +
        `preview: ${JSON.stringify(lines.slice(0, 40))}`,
    );
  }

  return squads;
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

    // Some series redirect straight to the real squads URL already (seen for series with
    // squads actually published); others land on the generic overview tab (Home / Fixtures
    // and Results / Teams / ...) and need one more client-side navigation to reach the
    // roster, behind whichever tab is labelled "Teams" or "Squads". Only bother clicking
    // through when we're not already there.
    let text = await page.evaluate(() => document.body?.innerText ?? "");
    if (!/squads?$/i.test(page.url())) {
      for (const label of ["Squads", "Teams"]) {
        try {
          // `.last()` because the same label usually also appears once in the site's global
          // top nav, which we don't want -- the series-specific sub-nav renders later in the DOM.
          const link = page.getByRole("link", { name: label, exact: true }).last();
          if ((await link.count()) === 0) continue;
          await link.click({ timeout: 5_000 });
          await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
          console.log(`[cricket] espn-squads-browser: clicked "${label}" tab -> ${page.url()}`);
          text = await page.evaluate(() => document.body?.innerText ?? "");
          break;
        } catch (err) {
          console.log(`[cricket] espn-squads-browser: click "${label}" failed: ${String(err)}`);
        }
      }
    }

    console.log(`[cricket] espn-squads-browser: rendered ${page.url()} -> ${text.length} char(s) of text`);
    return parseSquadsFromRenderedText(text, page.url());
  } catch (err) {
    console.log(`[cricket] espn-squads-browser: scrape failed for ${url}: ${String(err)}`);
    return [];
  } finally {
    await browser.close().catch(() => {});
  }
}
