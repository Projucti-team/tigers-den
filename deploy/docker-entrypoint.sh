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

# After Coolify/VPS deploy: ensure tours exist (skips if snapshots already fresh).
# Set CRICKET_SYNC_ON_START=0 to disable. Set to "force" to always run full sync.
if [ -n "${CRON_SECRET:-}" ] && [ -n "${CRICKET_DATA_API_KEY:-}" ]; then
  case "${CRICKET_SYNC_ON_START:-1}" in
    0|false|no|off) ;;
    *)
      sync_url="http://127.0.0.1:3000/api/admin/bootstrap-db"
      if [ "${CRICKET_SYNC_ON_START}" = "force" ]; then
        sync_url="${sync_url}?forceCricketSync=1"
      fi
      (
        i=0
        while [ "$i" -lt 45 ]; do
          if wget -qO- http://127.0.0.1:3000/ >/dev/null 2>&1; then
            wget -qO- --post-data="" \
              --header="Authorization: Bearer ${CRON_SECRET}" \
              "${sync_url}" >/dev/null 2>&1 \
              && echo "[entrypoint] cricket bootstrap/sync finished" \
              || echo "[entrypoint] cricket bootstrap failed — check CRON_SECRET and logs"
            break
          fi
          i=$((i + 1))
          sleep 2
        done
      ) &
      ;;
  esac
fi

exec node server.js
