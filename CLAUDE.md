# Tigers Den — Codebase Reference

Bangladesh cricket fan site: live match centre, ICC rankings, tours, The Roar chat, The Stand social feed, member profiles.

**Stack:** Next.js 16 + Payload CMS 3 + Tailwind 4 + NextAuth + Firestore (real-time chat) + Postgres (production)  
**Deploy:** Coolify + Hetzner (Postgres co-hosted, Firebase for chat)

---

## Dev Setup

```bash
npm install
cp .env.example .env.local
# Edit .env.local: set PAYLOAD_SECRET (openssl rand -base64 32), other keys
npm run dev
```

Local dev: `docker-compose.yml` spins Postgres automatically (matching production).
- Admin: http://localhost:3000/admin (create super-admin on first visit)
- App: http://localhost:3000

**Key .env vars:**
- `PAYLOAD_SECRET` — CMS auth seed
- `DATABASE_URI=file:...` (SQLite, legacy) OR `POSTGRES_URL` (current)
- `CRICKET_DATA_API_KEY`, fallbacks — CricketData provider
- `NEXT_PUBLIC_FIREBASE_*`, `FIREBASE_*` — Firestore (chat, real-time)
- `CRON_SECRET` — protects bootstrap + cricket sync jobs
- `GOOGLE_*`, `FACEBOOK_*` — OAuth for member sign-in

---

## Directory Structure

```
app/
  (frontend)/          # Public pages: /, /match-centre, /tours, /rankings, /the-stand, /join, /about, /chants
  (payload)/           # Payload admin UI + REST
  api/
    admin/             # Admin endpoints (CMS-protected)
    cron/              # Job dispatchers (cricket sync, scheduled tasks)
    social/            # Members, posts, follows, reactions
    chat/              # The Roar (Firestore-backed)

collections/           # Payload CMS schema (Hero, Posts, Chants, Media, Users, Players, Countries, CricketSnapshots, social)

components/            # React (Hero, Rankings, Tours, TheSand, Match, MemberProfile, MemberPost, Chat, Feedback)

lib/
  cricket/
    providers/         # CricAPI, ESPN, ICC fetchers
    services/          # Snapshots, tours, rankings builders; sync state; job dispatch
    sync-jobs.ts       # Job registry + parser
  firebase/            # Firestore client + admin setup
  match-chat/          # The Roar: Firestore message model, security
  social/              # Social graph: members, posts, followers, reactions, comments
  stand/               # The Stand reactions, comments (independent from social)
  payload-ensure-postgres-schema.ts  # Boot-time schema setup

data/                  # JSON caches (icc-rankings, wtc-standings, bangladesh-last-match, bangladesh-cricket-news, espn-tour-squads, tours)
                       # Committed to git + volume-mounted on prod

deploy/                # Docker entrypoint, production helpers

docs/
  architecture.md      # System design, data stores, providers, collections
  jobs.md              # Cron schedule, job details, bootstrap
  cricket-api.md       # Cricket providers, API routes, data shapes
  firebase-chat.md     # The Roar — Firestore setup, security rules
  deploy-coolify.md    # **Primary** deploy guide (Coolify + Hetzner)
  deploy-production.md # Manual Docker on VPS (reference only)
  migrate-neon-to-server-postgres.md # DB migration notes

migrations/            # Postgres migrations (tour_sync_state, feedback, social, etc.)
payload.config.ts      # Payload CMS configuration
```

---

## Key Features

| Feature | Files | Purpose |
|---------|-------|---------|
| **Cricket Sync** | `lib/cricket/services/sync-cricket-snapshots.ts`, sync-jobs.ts, `/api/cron/cricket` | Modular jobs: tours (CricAPI), squads (ESPN), rankings (ICC), Bangladesh live, WTC |
| **Squad Refresh** | `refresh-squads-for-active-tours.ts`, `update-tour-sync-state.ts`, `tour_sync_state` table | Selective, frequent (2–3×/day) squad fetch for active tours only |
| **Feedback System** | `components/FeedbackButton`, `/api/feedback`, `migrations/*feedback*` | User feedback collection (title, description, category, image) — standalone, not Payload collection |
| **The Roar** | `lib/match-chat/`, `app/api/chat/`, Firestore | Live match chat; real-time messaging via Firestore; security rules limit to verified members |
| **The Stand** | `lib/social/`, `/the-stand`, Payload MemberPosts | Member social feed: posts, reactions, comments, follow graph |
| **Auth** | NextAuth (`lib/auth.ts` if exists), OAuth (Google, Facebook) | Member sign-in; Payload Users separate (admin-only) |
| **Rankings** | `lib/cricket/services/build-rankings.ts`, ICC + WTC data | ICC team/player rankings + WTC standings, updated daily |

---

## npm Scripts

```bash
npm run dev              # Turbopack dev server (Postgres in Docker)
npm run build            # Production build (generates import map for Payload)
npm run start            # Run built app
npm run generate:types   # Regenerate payload-types.ts from CMS schema
npm run generate:importmap  # Regenerate Payload admin import map (req'd for Docker)
npm run sync:cricket     # Trigger POST /api/cron/cricket (local dev server must run)
npm run test             # Unit + Playwright E2E tests
npm run test:unit        # Cricket logic + snapshot audit
npm run test:e2e         # UI tests (tours, venues, results, fixtures)
npm run scrape:*         # Refresh JSON caches (icc-rankings, wtc, bangladesh-match, bangladesh-news, espn-squads)
npm run db:shell         # Connect to Postgres shell (dev only)
npm run migrate          # Run pending migrations (Postgres)
```

---

## Cricket Sync Architecture

Modular, state-driven jobs (not monolithic daily sync):

```
Cron / Admin Dispatch (/api/cron/cricket or /api/admin/cricket-sync)
    ↓
    ├─ syncToursIndex() [CricAPI, daily] → tours, details, build snapshots → tour_sync_state
    ├─ refreshSquadsForActiveTours() [ESPN, 2–3×/day] → selective squad fetch
    ├─ syncRankings() [ICC + WTC, daily] → icc-rankings.json, wtc-standings.json
    ├─ syncBangladeshLive() [ESPN, 2–3×/day] → bangladesh-last-match.json
    └─ (more jobs as needed)
```

**Job parameters:** `?jobs=tours,squads,rankings` or `?job=squads` (backward-compat)

**Key table:** `tour_sync_state` (tour_id, current_status, test/odi/t20_series_status, squad_import_complete_*, last_*_sync timestamps)

**Cron jobs (Coolify scheduled tasks):**
- 3:00 AM: `?jobs=tours` (CricAPI daily fetch)
- 3:15 AM, 12 PM, 6 PM: `?jobs=squads` (selective ESPN fetch)
- 3:30 AM: `?jobs=rankings` (ICC + WTC)
- 3:45 AM: `?jobs=last-match,upcoming` (Bangladesh live)

Details: [docs/jobs.md](docs/jobs.md)

---

## Feedback System

**Status:** Live, standalone feature (not Payload collection).

**Components:**
- Floating button (bottom-right, amber): on all pages
- Modal form: title, description, category (bug/feature/other), email/name, page URL
- API: `/api/feedback` (POST → JSON submission → direct DB insert + timeline)
- Status workflow: new → under_review → ticket_raised → in_progress → resolved/dismissed
- Timeline: tracks all status changes with timestamps + notes
- Admin panel (Payload): view/filter feedback, change status, edit notes

**Why standalone?** Payload auto-manages schema, which conflicted with sync. Direct SQL + API avoids Payload's auto-migration.

**DB schema:** `feedback` table (migration: 20260706_*), fields: id, title, description, category, email, name, pageUrl, userId, image_id, status, createdAt, updatedAt. Timeline tracked in `feedback_timeline` table.

---

## Payload CMS Collections

| Collection | Purpose | Editor? |
|-----------|---------|---------|
| Hero | Homepage banner slides | ✅ |
| Posts | Announcements, pin to The Stand | ✅ |
| Chants | Fan chant library | ✅ |
| Media | Image uploads | ✅ |
| Users | Admin / moderator accounts | ✅ (admin only) |
| Players, Countries | Player registry | — (API-driven) |
| CricketSnapshots | Pre-built tour pages, venue guides | — (cron-written) |
| Members, MemberPosts, Stand\* | Social graph | — (API-driven) |

---

## Testing

```bash
npm run test:unit
# Runs: cricket logic tests (squad refresh targets, format status), tour snapshot audit

npm run test:e2e
# Runs: Playwright tests on public pages (tour fixtures, venues, rankings)

npm run test -- --coverage
# Full coverage report (target: 90%+)
```

Pre-deploy checklist:
```bash
bash scripts/test-before-deploy.sh
# Runs unit tests + feedback integration tests
```

---

## Common Tasks

### Add a new cricket job
1. Create function in `lib/cricket/services/sync-cricket-snapshots.ts` (~50–150 lines)
2. Register in `lib/cricket/sync-jobs.ts` (add to JOB_REGISTRY)
3. Test locally: `curl -X POST http://localhost:3000/api/cron/cricket?jobs=<name>&wait=1`

### Update Payload schema
1. Edit collection in `collections/`
2. `npm run generate:types` (updates `payload-types.ts`)
3. `npm run generate:importmap` (updates admin import map)

### Deploy a change
1. `git push` to main
2. Coolify detects, builds Dockerfile, deploys to Hetzner
3. Migrations run auto-magically during boot (if using Postgres)
4. Monitor logs for errors

### Manually run a sync job
```bash
# Local dev (server must be running)
npm run sync:cricket
# Or specific job
curl -X POST http://localhost:3000/api/cron/cricket?jobs=squads -H "Authorization: Bearer dev-secret"

# Production (via Coolify)
POST https://tigersden.example.com/api/cron/cricket?jobs=squads
(with CRON_SECRET header)
```

### Check tour sync state
```bash
npm run db:shell
SELECT * FROM tour_sync_state;
```

---

## Key Files Quick Reference

| File | Purpose |
|------|---------|
| `lib/cricket/services/sync-cricket-snapshots.ts` | All modular sync jobs (~800 lines) |
| `lib/cricket/services/update-tour-sync-state.ts` | Tour state tracking logic |
| `lib/cricket/services/refresh-squads-for-active-tours.ts` | Selective squad fetch |
| `lib/cricket/services/tour-sync-state-db.ts` | DB queries for tour state |
| `lib/cricket/sync-jobs.ts` | Job registry + parser |
| `app/api/cron/cricket/route.ts` | Cron endpoint (dispatcher) |
| `app/api/admin/cricket-sync/route.ts` | Admin UI endpoint |
| `components/FeedbackButton.tsx`, `FeedbackModal.tsx` | Feedback UI |
| `app/api/feedback/route.ts` | Feedback API |
| `collections/Feedback.ts` | Feedback CMS config (disabled; standalone table) |
| `migrations/20260705_000000_tour_sync_state.ts` | Tour state table |
| `migrations/20260706_000000_feedback.ts` | Feedback table |
| `payload.config.ts` | Payload CMS config (collections, plugins, auth) |
| `app/(payload)/admin/[[...segments]]/page.tsx` | Payload admin shell |
| `deploy/entrypoint.sh` | Docker startup (migrations, app boot) |
| `docker-compose.yml` | Local Postgres setup |

---

## Memory & Preferences

- **Daily Airtable update:** One row per day logging progress (project: [Airtable Logging Practice](docs/HANDOVER.md))
- **Terse responses:** No trailing summaries or closing pleasantries
- **Standalone feedback:** Not a Payload collection; direct DB + API (avoid Payload auto-migration conflicts)

---

## Next Steps (if planning new work)

1. **Admin UI for feedback:** Dashboard showing feedback by status, category filters, timeline view
2. **Squad comparison UI:** Show which squads are missing or changed (for tours page)
3. **Performance audit:** Profile sync jobs; optimize SQL queries if needed
4. **Player statistics:** Expand player registry with career stats (batting, bowling, recent form)
5. **Live scoreboard:** Real-time match updates (currently snapshot-based)

See HANDOVER.md for full recent work log and architecture notes.

---

## Deploy Checklist

Before pushing to production:
- [ ] `npm run test` passes (unit + E2E)
- [ ] `bash scripts/test-before-deploy.sh` passes
- [ ] `npm run build` succeeds
- [ ] `npm run generate:importmap` (Payload import map updated)
- [ ] Migrations are idempotent (safe to re-run)
- [ ] `.env.production` has all required keys (POSTGRES_URL, CRICKET_DATA_API_KEY, CRON_SECRET, Firebase, OAuth)
- [ ] Coolify task schedule is set (see docs/jobs.md)

---

## Useful Links

- **Production site:** https://tigersden.cricket (or your domain)
- **Coolify dashboard:** (your Coolify instance)
- **Airtable Base:** https://airtable.com/app/appe8oeguzTq8XzY5 (project log)
- **Firebase Console:** https://console.firebase.google.com/ (chat/Firestore)
- **Cricket data:** https://cricketdata.org/data/ or CricAPI docs

---

**Last updated:** 2026-07-06  
**Maintained by:** @mdhasanrahman
