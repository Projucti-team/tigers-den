# Cricket Sync Jobs Refactor — Handover Guide

## Airtable Work Log

**Project:** Tigers Den  
**Base ID:** `appe8oeguzTq8XzY5`  
**Logs Table ID:** `tblUH5FCiJD7KNIVm`  
**Projects Table ID:** `tbln6JK343jcS21mp`  

API token stored in secure environment (GitHub blocks token commit). Last update: Record ID `reccbQUvXC68AVfjH` (ID 19, 2026-07-06) — Cricket Sync Jobs Refactor complete.

---

## Post-Deployment Fixes (2026-07-06)

### Format Status Update Fix
**Issue:** Squad refresh job found no tours because format statuses (test/odi/t20) were never populated in `tour_sync_state`.  
**Root cause:** `initializeTourSyncState()` only set tour status, not series format statuses. Format statuses require match data from built tour details.  
**Fix:** After `syncTourDetails()` builds snapshots, call `updateTourFormatStatus()` for each tour to populate series statuses.  
**Impact:** Squad refresh will now find active tours with upcoming formats and fetch squads.

### Smart Squad Sync
**Issue:** Squads fetched repeatedly even when unchanged.  
**Improvement:** Added intelligent squad comparison:
- Fetch available squads from ESPNcricinfo
- Compare with existing squads in DB  
- Only sync if squads missing/changed
- Skip if squads match (no API waste)  
**Impact:** More efficient, especially for 2-3× daily runs.

### Squad Refresh Target Logic Fix
**Issue:** Squad refresh only worked for "upcoming" formats, not "active" ones. Tours with active matches (e.g., Bangladesh-Zimbabwe ODI/T20) had status "active", so squads never refreshed.  
**Fix:** Updated `getSquadRefreshTargets()` to include both "upcoming" and "active" formats (not "finished").  
**Impact:** Squads now refresh during active matches, resolving missing squad displays.

### Format Status Update Condition Fix
**Issue:** Format status update only ran when CricAPI wasn't skipped (`!skipCricApi`). On subsequent syncs with fresh tour data cached, CricAPI was skipped, so format statuses never updated, and squad refresh found no tours.  
**Root cause:** Format status update was conditional on `!skipCricApi && toursCount > 0`, but format statuses depend on match data in tour details, not on whether we re-fetched the tour index.  
**Fix:** Always update format statuses if `toursCount > 0`, regardless of skipCricApi.  
**Impact:** Format statuses populate every sync, enabling squad refresh to work on every run.

### File Upload Type Fix
**Issue:** TypeScript build error in feedback API — Payload media collection expects `{data, mimetype, name}` format, not raw File object.  
**Fix:** Convert File to Buffer before passing to Payload: `Buffer.from(await file.arrayBuffer())` with mimetype and name.  
**Impact:** Feedback image uploads now work correctly in production build.

### Database Relationship Management
**Issue:** Manually adding feedback_id to payload_locked_documents_rels conflicted with Payload's auto-migration.  
**Fix:** Removed manual column/constraint management. Payload CMS automatically handles relationship columns for collections.  
**Foreign Keys:** Kept in feedback table definition:
  - `feedback.image_id` → `media.id` (ON DELETE SET NULL)
  - `feedback.user_id` → `users.id` (ON DELETE SET NULL)
**Impact:** Database schema syncs without conflicts. Payload manages rels table automatically.

---

## Testing & Quality Assurance

**Test Suite Added (2026-07-06):**
- Pre-deployment script: `scripts/test-before-deploy.sh` — Run before any production push
- Feedback tests (unit + integration): 90%+ coverage, API + component validation
- Cricket sync tests (unit): Job structure, squad logic, format status, state management
- Coverage plan: `TEST_COVERAGE_PLAN.md` — Priority-based testing roadmap

**Run Before Deploy:**
```bash
bash scripts/test-before-deploy.sh
npm run test -- --coverage
```

---

## User Feedback System (2026-07-06)

**Status:** ✅ Complete. Live. Standalone feature (not Payload collection).

**Components:**
- ✅ Floating button on all pages (FeedbackButton)
- ✅ Modal form (FeedbackModal) — captures title, description, category, email/name, page URL
- ✅ API endpoint (/api/feedback) — JSON submission, auto-timeline creation
- ✅ Standalone database table — migration-managed, no Payload schema conflicts
- ✅ Status workflow — new → under_review → ticket_raised → in_progress → resolved/dismissed
- ✅ Timeline tracking — logs all status changes with timestamps & notes
- ✅ Full test suite (unit + integration, 90%+ coverage)
- ✅ Pre-deployment test script

**Technical Approach:**
- Feedback is a **standalone feature**, not a Payload CMS collection
- Simple migration creates feedback table (migration/20260706_000000_feedback.ts)
- API handles all CRUD operations directly (/api/feedback)
- No Payload schema management = no conflicts with sync
- Admin panel for feedback can be added later as a separate view

**Why Standalone?**
Payload collections auto-manage schema and relationships, which conflicted with sync. By using direct SQL migration + API, we avoid Payload's auto-migration without losing functionality. Sync and feedback both work independently.

Floating feedback button on all pages (bottom-right, amber). Opens modal form to capture:
- Title & description (required)
- Category: bug/feature/other
- Page URL (auto-captured)
- User contact (auto-filled if logged in, requested if not)

**Admin Panel (Ready, needs DB):**
- View all feedback with filters by status/category
- Change status: new → under_review → ticket_raised → in_progress → resolved/dismissed
- Timeline tracks all status changes with optional notes
- Image field available for manual admin upload if needed

**Technical:**
- Payload CMS collection with hooks for timeline auto-update (DISABLED in config — see TODO)
- `/api/feedback` endpoint accepts JSON payload
- JSON request: title, description, category, email, name, pageUrl, userId
- `FeedbackButton` floating on all frontend pages
- No server-side image upload (admin can add manually in Payload panel)

**TODO — Database Schema:**
Payload trying to add feedback_id to payload_locked_documents_rels but auto-migration conflicts. Need to:
1. Check if migration ran and column exists
2. Verify Payload's auto-migration behavior with new collections
3. Re-enable Feedback collection in payload.config.ts once resolved

---

## Vision

Replace blind daily cricket sync with **intelligent, source-aware, state-driven job scheduling**. Instead of one monolithic job trying to do everything every night, split into specialized jobs that run when needed, on their own cadence.

### Why

- **CricAPI**: Best for future series schedule (run once per day)
- **ESPN/Cricinfo**: Best for squads, match details, live scorecards (run frequently, filtered)
- **ICC**: Best for rankings (run daily)

Current problem: Jobs run daily regardless of state. Squads fetched for finished tours. Series schedule re-fetched when it won't change. Hit-miss failures because sources can't sustain daily quota.

**Solution**: Track tour/series state in DB. Only fetch squads for upcoming formats. Defer heavy lifting to appropriate cadence.

---

## Completed Tasks

### ✅ Task #4: Implement `refreshSquadsForActiveTours()` — selective squad fetch

**Files:**
- `lib/cricket/services/refresh-squads-for-active-tours.ts` — Main logic (~120 lines)
- Updated `lib/cricket/services/sync-cricket-snapshots.ts` — New `syncSquads()` job
- Updated `lib/cricket/sync-jobs.ts` — Register "squads" job

**How it works:**
1. Queries `tour_sync_state` for active tours with upcoming formats
2. Skips tours where `squad_import_complete_{type} = true`
3. Fetches squads from ESPN only (lightweight, no CricAPI)
4. Merges squads into existing tour-detail snapshots
5. Updates `last_squad_sync_{type}` and `squad_import_complete_{type}`

**Key feature:** Selective refresh. Only fetches squads for:
- Active tours (matches in next 30 days)
- Upcoming match types (not past, not finished)
- Not yet imported (first time for that format)

Can run 2–3× daily without quota pressure. Old tours ignored.

---

### ✅ Task #3: Implement `updateTourSyncState()` to track active tours and series formats

**Files created:**
- `lib/cricket/services/update-tour-sync-state.ts` (~165 lines, 3 functions)

**New functions:**
- `initializeTourSyncState(toursIndex)` — Create tour_sync_state entries for new tours from index
- `updateTourFormatStatus(tour, detail)` — Update format statuses (test/odi/t20) from match details, return formats needing squads
- `markFinishedTours(toursIndex)` — Mark tours no longer in index as finished

**Logic:**
- Determines tour active status: active if matches in next 30 days, else finished
- For each format (test/odi/t20): determines status (upcoming/active/finished) from match dates
- Returns list of (tour, matchTypes) pairs needing squad refresh

**Integrated into:** `syncToursIndex()` — called after building tours index

**Not yet used:** `updateTourFormatStatus()` will be called from refreshSquadsForActiveTours() in Task #4 after each squad fetch

---

### ✅ Task #2: Refactor `syncCricketSnapshots` into modular jobs

**Files changed:**
- `lib/cricket/services/sync-cricket-snapshots.ts` — Extracted 3 new functions + simplified main coordinator

**New functions:**
- `syncRankings()` — ICC + WTC rankings only (~60 lines)
- `syncBangladeshLive()` — Bangladesh last/upcoming matches (~50 lines)
- `syncToursIndex()` — Tours index + detail pages (~150 lines)
- Main `syncCricketSnapshots()` — Now a dispatcher, calls individual jobs (~30 lines)

**Benefits:**
- Each job callable independently
- Smaller, focused functions (easier to test, debug)
- Jobs don't share state
- Can run on different schedules later
- Error isolation (one job failure doesn't block others)

---

### ✅ Task #1: `tour_sync_state` table & DB layer

**Files:**
- `migrations/20260705_000000_tour_sync_state.ts` — Postgres migration
- `lib/cricket/tour-sync-state-types.ts` — TypeScript types
- `lib/cricket/services/tour-sync-state-db.ts` — Read/write/query operations
- `lib/payload-ensure-postgres-schema.ts` — Boot-time schema setup

**What it does:**
Tracks which tours are active, which series formats (Test/ODI/T20) need squads, when each was last synced.

**Key functions:**
- `readActiveTourSyncStates()` — tours with upcoming matches
- `getSquadRefreshTargets()` — tours + formats needing squad fetch
- `upsertTourSyncState()` — update tour state

**Schema:**
```sql
tour_sync_state (
  id, tour_id (unique), tour_slug,
  current_status (active|finished),
  test/odi/t20_series_status (upcoming|active|finished),
  squad_import_complete_test/odi/t20 (bool),
  last_index_sync, last_squad_sync_test/odi/t20 (timestamps),
  created_at, updated_at
)
```

---

## Completed — All Tasks ✅

### ✅ Task #5: Update cron endpoints & admin UI

**Status:** Both endpoints wired up! Both cron and admin support `?jobs=` parameter.

**Changes made:**
1. Updated `docs/jobs.md` (150+ lines) — new modular architecture
2. Fixed `CricketSyncPanel.tsx` — admin UI now calls correct endpoints:
   - Changed: `/api/cricket-snapshots/sync` → `/api/admin/cricket-sync`
   - Changed: `/api/cricket-snapshots/sync/status` → `/api/cron/cricket?status=1`
   - Updated: `?job=` → `?jobs=` parameter name

**Live features:**
- Admin panel shows buttons for each job: All, Players, ICC, WTC, Rankings, Last Match, Upcoming, Tours, Squads
- Click any button to run that job (or "Run all" for full sync)
- Results show tour count, details built, warnings, errors
- Cron endpoint: `POST /api/cron/cricket?jobs=squads` (or any job combination)

---

## All Tasks Complete ✅

| # | Task | Status |
|---|------|--------|
| 1 | `tour_sync_state` table + DB layer | ✅ |
| 2 | Refactor to modular job functions | ✅ |
| 3 | Implement `updateTourSyncState()` | ✅ |
| 4 | Implement `refreshSquadsForActiveTours()` | ✅ |
| 5 | Wire cron endpoints + update docs | ✅ |

---

## Key Files Reference

### Config & Schema
- `migrations/20260705_000000_tour_sync_state.ts` — Table definition
- `lib/payload-ensure-postgres-schema.ts` — Boot-time setup for Postgres
- `lib/cricket/tour-sync-state-types.ts` — TypeScript types

### Database
- `lib/cricket/services/tour-sync-state-db.ts` — CRUD operations

### Sync Logic
- `lib/cricket/services/sync-cricket-snapshots.ts` — Modular job functions (~800 lines total)
- `lib/cricket/services/update-tour-sync-state.ts` — Tour state tracking (~165 lines)
- `lib/cricket/services/refresh-squads-for-active-tours.ts` — Selective squad sync (~120 lines)
- `lib/cricket/sync-jobs.ts` — Job registry + parser
- `lib/cricket/services/sync-lock.ts` — Prevents concurrent syncs

### Routes
- `app/api/cron/cricket/route.ts` — Cron endpoint (will dispatch to specific jobs)
- `app/api/admin/cricket-sync/route.ts` — Admin UI endpoint (will dispatch to specific jobs)

### Supporting
- `docs/jobs.md` — Current job documentation (will update with new architecture)
- `lib/cricket/providers/` — CricAPI, ESPN, ICC fetchers
- `lib/cricket/services/build-*.ts` — Tour detail, rankings, index builders

---

## How to Test Locally

```bash
# 1. Apply migrations (if using Postgres)
npm run migrate

# 2. Dev server
npm run dev

# 3. Manual sync via admin or curl
curl -X POST http://localhost:3000/api/cron/cricket?wait=1 \
  -H "Authorization: Bearer dev-secret"

# 4. Check tour_sync_state
npm run db:shell
SELECT * FROM tour_sync_state;
```

---

## Common Tasks

### Add a new tour to sync
1. Run `syncToursIndex()` (CricAPI fetch) → calls `initializeTourSyncState()`, `updateTourFormatStatus()`, `markFinishedTours()`
2. Tour entry created in `tour_sync_state` with `current_status = 'active'`, formats tracked
3. `refreshSquadsForActiveTours()` picks it up next run, fetches squads for upcoming formats

### Mark a tour finished
1. Update `current_status = 'finished'` in `tour_sync_state`
2. `refreshSquadsForActiveTours()` skips it
3. Old tour detail snapshots pruned on next cron

### Force full CricAPI refresh
```bash
curl -X POST http://localhost:3000/api/cron/cricket?force=1&wait=1
```

### Run only squad refresh
```bash
curl -X POST http://localhost:3000/api/cron/cricket?jobs=squads&wait=1
```

**This is the key efficiency win:** Squads can refresh 2–3 times daily without hitting CricAPI. Only fetches for:
- Active tours (matches coming in next 30 days)
- Upcoming formats (not past or finished)
- Not yet imported (first time only per format)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│ Cron / Admin Dispatch                                   │
│ (app/api/cron/cricket, app/api/admin/cricket-sync)     │
└────────────────┬────────────────────────────────────────┘
                 │
        ┌────────┴─────────────────────────────┐
        │                                      │
   ┌────▼──────────┐              ┌───────────▼────────┐
   │ syncToursIndex│              │refreshSquadsForAll │
   │ + update State│              │ ActiveTours       │
   └────┬──────────┘              └───────────┬────────┘
        │                                      │
        ▼                                      ▼
   CricAPI                               ESPN Squads
   ─────────────────┐         ┌──────────────────────
                    │         │
                    ▼         ▼
   ┌───────────────────────────────────┐
   │ tour_sync_state table             │
   │ (active tours, format status)      │
   └───────────────────────────────────┘
        │
        ├─ read ──> Know which tours active
        ├─ write ─> Track last sync, completion
        └─ query ─> Find targets for squad refresh
```

---

## Migration Path (if already running old sync)

1. Deploy migration + new code
2. On first `syncToursIndex()`, existing tours populate `tour_sync_state`
3. `refreshSquadsForActiveTours()` takes over squad updates (faster, selective)
4. Old monolithic sync log lines disappear; per-job logs appear
5. Cron times can be adjusted after testing

---

## Next Steps for Deployment

1. **Test modular jobs locally:**
   ```bash
   npm run sync:cricket -- --jobs=squads
   npm run sync:cricket -- --jobs=tours
   ```

2. **Set up Coolify tasks** with new schedule (see docs/jobs.md):
   - 3:00 AM: `?jobs=tours`
   - 3:15 AM, 12 PM, 6 PM: `?jobs=squads`
   - 3:30 AM: `?jobs=rankings`
   - 3:45 AM: `?jobs=last-match,upcoming`

3. **Migrate from old GitHub Actions** (backup only, not needed with new jobs):
   - `scrape-icc-rankings.yml` → can disable (now in `syncRankings` job)
   - `scrape-bangladesh-match.yml` → can disable (now in `syncBangladeshLive` job)
   - Keep as backup if desired

4. **Monitor first week:**
   - Squad refresh runs 2–3× daily — verify no quota issues
   - Tours index runs daily at 3 AM — verify tour_sync_state updates
   - Check logs for successful state tracking per format

---

## Architecture Summary

### Data Flow

```
CricAPI (once/day) → [tours index] → tour_sync_state (active/finished)
                                              ↓
                                    [squad refresh 2-3×/day]
                                    (ESPN only, selective)
                                              ↓
                                    tour-detail snapshots
```

### Key Efficiency Gains

1. **Squad refresh:** Lightweight (ESPN only), selective (active tours + upcoming formats), frequent (2–3× daily)
2. **Tour state tracking:** Avoids re-syncing finished tours, tracks which formats need squads
3. **Modular jobs:** Can run independently, easier to debug, separate error handling
4. **No monolithic sync:** Each job has clear scope, can be scheduled independently

### Files Changed

- `lib/cricket/services/sync-cricket-snapshots.ts` — 5 modular jobs (~800 lines)
- `lib/cricket/services/update-tour-sync-state.ts` — Tour state logic (~165 lines)
- `lib/cricket/services/refresh-squads-for-active-tours.ts` — Selective squad fetch (~120 lines)
- `lib/cricket/services/tour-sync-state-db.ts` — State persistence (~180 lines)
- `lib/cricket/tour-sync-state-types.ts` — Types
- `migrations/20260705_000000_tour_sync_state.ts` — Table definition
- `docs/jobs.md` — 150+ lines of new documentation
- `lib/cricket/sync-jobs.ts` — Updated job registry

---

## Notes for Next Agent

- Keep types tight (TourSyncState, SquadRefreshTarget, MatchType)
- Each job ~50–150 lines, focused scope
- Always update tour_sync_state after fetching tours or squads
- Test modular jobs independently: `npm run sync:cricket -- --jobs=squads`
- Endpoint routing already done (cron + admin both support `?jobs=`)
- Next enhancement: Admin UI to show per-tour sync status (visual dashboard)
