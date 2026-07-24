/**
 * @deprecated Removed — headless-browser scraping of ESPN's squads pages turned out to be
 * fragile (client-side-only rendering, bot detection, breaks on every ESPN layout change) and
 * heavy for a memory-constrained production host. The squad pipeline now uses CricAPI +
 * ESPN's Core Sports API automatically, with an admin-pinned news-story URL as the manual
 * fallback when neither has data yet — see refreshEspnTourSquads() in ./espn-squads.ts.
 *
 * This file is no longer imported anywhere. Safe to `git rm` it (the sandbox that made this
 * edit can't delete files in your synced folder, only clear their contents).
 */
export {};
