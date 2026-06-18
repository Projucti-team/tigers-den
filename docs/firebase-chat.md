# The Roar — Firebase live chat

Match-centre chat uses **Firestore** for instant updates (`onSnapshot`). Postgres/Payload only handles members and auth; messages are not stored in `match-chat-messages` anymore.

**Architecture:** [architecture.md](./architecture.md)

## Setup

1. [Firebase console](https://console.firebase.google.com/) → create a project (or use an existing one).
2. **Build** → **Firestore Database** → create database (production mode).
3. **Build** → **Firestore** → **Rules** → paste `firestore.rules` from this repo → **Publish**.
4. **Project settings** → **Your apps** → add **Web** app → copy the config into Coolify env:
   - `NEXT_PUBLIC_FIREBASE_API_KEY`
   - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - `NEXT_PUBLIC_FIREBASE_APP_ID`
5. **Project settings** → **Service accounts** → **Generate new private key** → set:
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_CLIENT_EMAIL`
   - `FIREBASE_PRIVATE_KEY` — paste the `private_key` value; keep `\n` as two characters or use a single-line quoted string in Coolify.

Redeploy after setting env vars. `NEXT_PUBLIC_*` values are baked at **build** time on Coolify — trigger a rebuild after changing them.

## Composite index

The first live chat load may log a Firestore index URL in the browser console. Open it and create the suggested index (`roomId` + `createdAt`).

## How it works

| Action | Path |
|--------|------|
| Read messages | Browser → Firestore `roar_messages` (`onSnapshot`) |
| Post message | Browser → `POST /api/match-chat` → NextAuth session check → Admin SDK write |

Client writes are blocked in `firestore.rules`; only the server can create messages.

## Legacy Payload tables

`match-chat-messages` / `match-chat-rooms` collections remain in Payload for old data but are unused by the UI. You can export and delete them later if needed.
