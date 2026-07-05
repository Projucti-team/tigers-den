# Cricket Sync Jobs Refactor — Handover Guide

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

## In Progress / Upcoming

### Task #3: Implement `updateTourSyncState()`

**Goal:** After CricAPI fetch, update tour state table.

**Responsibilities:**
- Read tours index from DB (after new fetch)
- For each tour, determine:
  - `current_status`: active if matches in next 30 days, else finished
  - Per-format status (upcoming/active/finished) based on match dates
  - When all squads for a format are loaded, set `squad_import_complete_{type} = true`
- Write changes to `tour_sync_state`
- Return list of (tour_id, format) pairs needing squad refresh

**When called:** After `syncToursIndex()` completes

---

### Task #4: Implement `refreshSquadsForActiveTours()`

**Goal:** Selective squad fetch — only for active tours with upcoming formats.

**Behavior:**
- Read `tour_sync_state`: find active tours with `{type}_series_status = 'upcoming'`
- Skip tours where `squad_import_complete_{type} = true`
- Fetch squads from ESPN only (not CricAPI)
- Upsert to existing tour-detail snapshots
- Update `last_squad_sync_{type}` and `squad_import_complete_{type}`

**Cron:** Run 2–3× daily (e.g., 3:15 AM, 12 PM, 6 PM BDT)

---

### Task #5: Update cron endpoints & admin UI

**Goal:** Route requests to individual modular jobs instead of one monolithic sync.

**Cron dispatch:**
- 3:00 AM: `syncToursIndex` + `updateTourSyncState`
- 3:15 AM, 12 PM, 6 PM: `refreshSquadsForActiveTours`
- 3:30 AM: `syncRankings`
- 3:45 AM: `syncBangladeshLive`

**Query params:**
- `?job=tours` — tours index only
- `?job=squads` — squad refresh only
- `?job=rankings` — rankings only
- `?jobs=tours,squads,rankings` — comma-separated

**Admin UI:**
- Show per-tour sync status (active/finished)
- Show per-format squad import status (pending/complete)
- Allow manual trigger of specific job

---

## Key Files Reference

### Config & Schema
- `migrations/20260705_000000_tour_sync_state.ts` — Table definition
- `lib/payload-ensure-postgres-schema.ts` — Boot-time setup for Postgres
- `lib/cricket/tour-sync-state-types.ts` — TypeScript types

### Database
- `lib/cricket/services/tour-sync-state-db.ts` — CRUD operations

### Sync Logic (will refactor)
- `lib/cricket/services/sync-cricket-snapshots.ts` — **Main file to split** (~500 lines)
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
1. Run `syncToursIndex()` (CricAPI fetch)
2. `updateTourSyncState()` creates entry in `tour_sync_state` with `current_status = 'active'`
3. `refreshSquadsForActiveTours()` picks it up next run, fetches squads per format

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

## Notes for Next Agent

- Keep types tight (TourSyncState, SquadRefreshTarget, etc.)
- Each job should be ~50–150 lines, not 500-line function
- Always update tour_sync_state after fetching tours or squads
- Test modular jobs independently before wiring up cron dispatch
- Update docs/jobs.md after each task (replaces old architecture diagrams)
- Add integration tests for updateTourSyncState logic (match date → series status mapping)

---

## Questions / Blockers

None currently. First task complete, architecture validated. Ready to refactor sync-cricket-snapshots.
