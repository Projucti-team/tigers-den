#!/usr/bin/env bash
# Lockfile is generated on macOS; npm ci on Linux skips other platforms' optional
# native bindings (sharp, lightningcss, libsql, @tailwindcss/oxide, etc.).
# Coolify/Docker uses `npm install` on Linux instead — see Dockerfile.
set -euo pipefail

npm install --include=optional --no-save --no-package-lock
