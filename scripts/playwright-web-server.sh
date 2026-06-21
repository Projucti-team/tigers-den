#!/usr/bin/env bash
# Playwright webServer — use next dev so Payload can push SQLite schema at runtime.
# Production `next build` collects admin/API page data and needs tables before build.
set -euo pipefail

PORT="${1:-3099}"
BASE_URL="${PLAYWRIGHT_BASE_URL:-http://127.0.0.1:${PORT}}"

export PORT
export PAYLOAD_SECRET="${PAYLOAD_SECRET:-playwright-test-secret-minimum-32-characters}"
export AUTH_SECRET="${AUTH_SECRET:-playwright-test-auth-secret-minimum-32-chars}"
export DATABASE_URI="${DATABASE_URI:-file:./.playwright-test.db}"
export PAYLOAD_SQLITE_PUSH_SCHEMA=1
export NEXT_PUBLIC_SITE_URL="${NEXT_PUBLIC_SITE_URL:-$BASE_URL}"
export NEXT_PUBLIC_SERVER_URL="${NEXT_PUBLIC_SERVER_URL:-$BASE_URL}"

rm -f .playwright-test.db .playwright-test.db-journal

exec npx next dev --webpack --port "$PORT"
