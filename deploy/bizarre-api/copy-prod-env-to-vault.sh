#!/usr/bin/env bash
# Copy live prod.env into an encrypted Vault directory (madvillainy), never into git.
# Run as root ON CT 103 after unlocking/mounting Vault on the destination, OR
# scp from CT then move into Vault on madvillainy.
#
# Example (from madvillainy, Vault already unlocked):
#   ssh -F ~/.ssh/config.ops-human-only bizarre-api-root \
#     'cat /etc/bizarre/prod.env' | install -m 600 /dev/stdin \
#     "$HOME/Vault/secrets/bizarre-api/prod.env"
set -euo pipefail

SRC="${SRC:-/etc/bizarre/prod.env}"
DEST_DIR="${DEST_DIR:-$HOME/Vault/secrets/bizarre-api}"
DEST="$DEST_DIR/prod.env"

if [[ ! -f "$SRC" ]]; then
  echo "❌ missing $SRC (run on CT 103 as root, or set SRC=)" >&2
  exit 1
fi
if [[ ! -d "$(dirname "$DEST_DIR")" ]] && [[ ! -d "$DEST_DIR" ]]; then
  echo "❌ Vault path missing: $DEST_DIR — unlock Vault first" >&2
  exit 1
fi

mkdir -p "$DEST_DIR"
umask 077
cp -a "$SRC" "$DEST"
chmod 600 "$DEST"
echo "✅ Wrote $DEST ($(wc -c <"$DEST") bytes) — keep Vault locked when idle"
