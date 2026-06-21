#!/usr/bin/env bash
# Lockfile is generated on macOS; npm ci on Linux skips other platforms' optional
# native bindings. Coolify/Docker uses `npm install` on Linux instead — see Dockerfile.
set -euo pipefail

npm install --include=optional --no-save sharp lightningcss @tailwindcss/oxide
