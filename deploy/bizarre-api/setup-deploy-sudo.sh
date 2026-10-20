#!/usr/bin/env bash
# One-time root setup so CI can deploy without restarting gunicorn.
#
# Run as root on CT 103 (bizarre-api), from an up-to-date prod tree:
#   bash /opt/bizarre-prod/deploy/bizarre-api/setup-deploy-sudo.sh
#
# Installs a root-owned copy of apply-units.sh at
# /usr/local/sbin/bizarre-apply-units and lets the CI deploy user run only
# that command through sudo. Re-run after apply-units.sh changes in the repo.
# Does not touch the existing /etc/sudoers.d/bizarre-deploy file.

set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Run as root." >&2
  exit 1
fi

DEPLOY_USER="${DEPLOY_USER:-bizarre-deploy}"
SRC_DIR="$(cd "$(dirname "$0")" && pwd)"
TARGET=/usr/local/sbin/bizarre-apply-units
SUDOERS=/etc/sudoers.d/bizarre-deploy-units

install -m 755 -o root -g root "$SRC_DIR/apply-units.sh" "$TARGET"
echo "Installed $TARGET"

TMP="$(mktemp)"
cat >"$TMP" <<EOF
# Managed by setup-deploy-sudo.sh. CI deploy may apply units and reload gunicorn.
${DEPLOY_USER} ALL=(root) NOPASSWD: ${TARGET}
EOF
visudo -cf "$TMP"
install -m 440 -o root -g root "$TMP" "$SUDOERS"
rm -f "$TMP"
echo "Installed $SUDOERS"
echo "Check: sudo -l -U ${DEPLOY_USER}"
