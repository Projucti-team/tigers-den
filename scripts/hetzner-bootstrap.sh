#!/usr/bin/env bash
# Run Payload migrations + cricket snapshot seed on the VPS (after app is up).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

read_env() {
  local key="$1"
  if [[ -f .env.production ]]; then
    grep -m1 "^${key}=" .env.production 2>/dev/null | cut -d= -f2- | tr -d '\r' || true
  fi
}

SECRET="${CRON_SECRET:-$(read_env CRON_SECRET)}"
BASE="${NEXT_PUBLIC_SITE_URL:-$(read_env NEXT_PUBLIC_SITE_URL)}"
BASE="${BASE:-http://127.0.0.1:3000}"
BASE="${BASE%/}"
URL="${BASE}/api/admin/bootstrap-db?forceCricketSync=1"

if [[ -z "$SECRET" ]]; then
  echo "Set CRON_SECRET in .env.production or export it before running."
  exit 1
fi

echo "POST $URL"
curl -fsS -X POST "$URL" \
  -H "Authorization: Bearer $SECRET" \
  -H "Content-Type: application/json"

echo ""
echo "Bootstrap request finished."
