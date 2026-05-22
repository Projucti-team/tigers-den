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

exec node server.js
