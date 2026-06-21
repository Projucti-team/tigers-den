#!/usr/bin/env bash
# Trigger tours + rankings sync on a running Docker/VPS deployment.
# Usage (on Hetzner): ./scripts/prod-cricket-sync.sh [--force]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f .env.production ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env.production
  set +a
fi

BASE="${NEXT_PUBLIC_SITE_URL:-http://127.0.0.1:3000}"
BASE="${BASE%/}"
SECRET="${CRON_SECRET:-}"
FORCE=0

for arg in "$@"; do
  if [[ "$arg" == "--force" ]]; then
    FORCE=1
  fi
done

if [[ -z "$SECRET" ]]; then
  echo "CRON_SECRET is not set in .env.production"
  exit 1
fi

QUERY=""
if [[ "$FORCE" == "1" ]]; then
  QUERY="?force=1"
fi

URL="${BASE}/api/cron/cricket${QUERY}"
echo "POST $URL (background sync)"

poll_sync_status() {
  local status_url="$1"
  local deadline=$((SECONDS + 600))

  while [[ "$SECONDS" -lt "$deadline" ]]; do
    sleep 10
    body="$(curl -fsS "${status_url}?status=1" -H "Authorization: Bearer ${SECRET}" 2>/dev/null || true)"
    if [[ -z "$body" ]]; then
      continue
    fi
    if echo "$body" | grep -q '"inProgress":true'; then
      echo "… still running ($(date -u +%H:%M:%S) UTC)"
      continue
    fi
    echo "$body"
    if echo "$body" | grep -q '"lastError"'; then
      if ! echo "$body" | grep -q '"lastError":null'; then
        echo "Sync failed — see lastError in response above."
        exit 1
      fi
    fi
    return 0
  done

  echo "Sync did not finish within 10 minutes — check server logs."
  exit 1
}

poll_sync_status_docker() {
  local deadline=$((SECONDS + 600))

  while [[ "$SECONDS" -lt "$deadline" ]]; do
    sleep 10
    body="$(docker compose exec -T app wget -qO- \
      --header="Authorization: Bearer ${SECRET}" \
      "http://127.0.0.1:3000/api/cron/cricket?status=1" 2>/dev/null || true)"
    if [[ -z "$body" ]]; then
      continue
    fi
    if echo "$body" | grep -q '"inProgress":true'; then
      echo "… still running ($(date -u +%H:%M:%S) UTC)"
      continue
    fi
    echo "$body"
    if echo "$body" | grep -q '"lastError"'; then
      if ! echo "$body" | grep -q '"lastError":null'; then
        echo "Sync failed — see lastError in response above."
        exit 1
      fi
    fi
    return 0
  done

  echo "Sync did not finish within 10 minutes — check server logs."
  exit 1
}

if command -v docker >/dev/null 2>&1 && docker compose ps -q app 2>/dev/null | grep -q .; then
  body="$(docker compose exec -T app wget -qO- \
    --post-data="" \
    --header="Authorization: Bearer ${SECRET}" \
    "http://127.0.0.1:3000/api/cron/cricket${QUERY}" \
    2>/dev/null || true)"
  echo "$body"
  poll_sync_status_docker
  echo "Cricket sync finished via container."
  exit 0
fi

if command -v curl >/dev/null 2>&1; then
  body="$(curl -fsS -X POST "$URL" -H "Authorization: Bearer ${SECRET}")"
  echo "$body"
  poll_sync_status "${BASE}/api/cron/cricket"
  echo "Cricket sync finished."
  exit 0
fi

echo "Install curl or run from a machine with docker compose."
exit 1
