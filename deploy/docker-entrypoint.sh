#!/bin/sh
set -e

# Seed cricket JSON into the persistent volume on first run
if [ -d /app/data-seed ]; then
  for f in /app/data-seed/*.json; do
    [ -f "$f" ] || continue
    base=$(basename "$f")
    if [ ! -f "/app/data/$base" ]; then
      cp "$f" "/app/data/$base"
    fi
  done
fi

mkdir -p /app/media

# Seed CMS uploads from image when volume is empty (optional dev copy)
if [ -d /app/media-seed ] && [ -z "$(ls -A /app/media 2>/dev/null)" ]; then
  cp -r /app/media-seed/. /app/media/ 2>/dev/null || true
fi

# Optional: refresh tours/rankings snapshots after the app is up (Hetzner / VPS).
if [ -n "${CRON_SECRET:-}" ] && [ "${CRICKET_SYNC_ON_START:-0}" = "1" ]; then
  (
    i=0
    while [ "$i" -lt 30 ]; do
      if wget -qO- http://127.0.0.1:3000/ >/dev/null 2>&1; then
        wget -qO- --post-data="" \
          --header="Authorization: Bearer ${CRON_SECRET}" \
          http://127.0.0.1:3000/api/cron/cricket >/dev/null 2>&1 \
          && echo "[entrypoint] cricket sync started" \
          || echo "[entrypoint] cricket sync request failed (will retry on cron)"
        break
      fi
      i=$((i + 1))
      sleep 2
    done
  ) &
fi

exec node server.js
