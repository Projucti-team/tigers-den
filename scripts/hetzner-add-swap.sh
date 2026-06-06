#!/usr/bin/env bash
# Add 4 GB swap on small Hetzner plans (CPX22 / CX23). Idempotent.
set -euo pipefail

SWAPFILE=/swapfile
SIZE=4G

if swapon --show | grep -q "$SWAPFILE"; then
  echo "Swap already active on $SWAPFILE"
  swapon --show
  exit 0
fi

if [[ -f "$SWAPFILE" ]]; then
  echo "Enabling existing $SWAPFILE"
  sudo swapon "$SWAPFILE"
  exit 0
fi

echo "Creating ${SIZE} swap at $SWAPFILE …"
sudo fallocate -l "$SIZE" "$SWAPFILE" || sudo dd if=/dev/zero of="$SWAPFILE" bs=1M count=4096 status=progress
sudo chmod 600 "$SWAPFILE"
sudo mkswap "$SWAPFILE"
sudo swapon "$SWAPFILE"

if ! grep -q "$SWAPFILE" /etc/fstab 2>/dev/null; then
  echo "$SWAPFILE none swap sw 0 0" | sudo tee -a /etc/fstab
fi

echo "Done:"
swapon --show
free -h
