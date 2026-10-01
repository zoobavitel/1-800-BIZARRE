#!/usr/bin/env bash
# Create a least-privilege "agent" user on CT 103 (bizarre-api) for Cursor triage.
#
# Run as root INSIDE the container once:
#   bash /opt/bizarre/deploy/bizarre-api/setup-agent-user.sh
#
# Then install the agent's public key (from 1Password) into ~agent/.ssh/authorized_keys
# with from="<madvillainy-tailscale-ip>",no-agent-forwarding,no-port-forwarding,no-X11-forwarding
#
# This script does NOT give write access to prod code, media, or prod.env.
# Fixes go through git → PR → deploy on madvillainy / agent tree.

set -euo pipefail

AGENT_USER="${AGENT_USER:-agent}"
PROD_TREE="${PROD_TREE:-/opt/bizarre-prod}"
MEDIA_ROOT="${MEDIA_ROOT:-/var/lib/bizarre}"
PROD_ENV="${PROD_ENV:-/etc/bizarre/prod.env}"
DB_NAME="${DB_NAME:-bizarre_db}"
DB_RO_USER="${DB_RO_USER:-bizarre_ro}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root inside CT 103" >&2
  exit 1
fi

echo "==> Create user ${AGENT_USER} (nologin shell override for SSH)"
if ! id -u "$AGENT_USER" >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash "$AGENT_USER"
fi

echo "==> Groups for log reading"
getent group systemd-journal >/dev/null && usermod -aG systemd-journal "$AGENT_USER" || true
getent group adm >/dev/null && usermod -aG adm "$AGENT_USER" || true

echo "==> Harden prod paths (owner stays app/deploy; no world write; env 600)"
mkdir -p /etc/bizarre "$MEDIA_ROOT" "$PROD_TREE"
if [[ -f "$PROD_ENV" ]]; then
  chmod 600 "$PROD_ENV"
  # Ensure agent cannot read secrets
  chown root:root "$PROD_ENV" || true
fi
# Prod tree + media: group-readable for ops if needed, not writable by agent
chmod -R u+rwX,go-w "$PROD_TREE" 2>/dev/null || true
chmod -R u+rwX,go-w "$MEDIA_ROOT" 2>/dev/null || true

echo "==> sudoers: status/journal only (no restart)"
SUDOERS="/etc/sudoers.d/90-bizarre-agent"
cat >"$SUDOERS" <<EOF
# Managed by setup-agent-user.sh — agent triage only
Defaults:${AGENT_USER} !authenticate
${AGENT_USER} ALL=(root) NOPASSWD: /bin/systemctl status bizarre-*, /bin/systemctl status gunicorn, /bin/systemctl status celery-worker, /bin/systemctl status caddy
${AGENT_USER} ALL=(root) NOPASSWD: /bin/journalctl -u bizarre-*, /bin/journalctl -u gunicorn, /bin/journalctl -u celery-worker, /bin/journalctl -u caddy
EOF
chmod 440 "$SUDOERS"
visudo -cf "$SUDOERS"

echo "==> Postgres read-only role (password via env AGENT_RO_PASSWORD or skipped)"
if command -v psql >/dev/null 2>&1; then
  if [[ -n "${AGENT_RO_PASSWORD:-}" ]]; then
    sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${DB_RO_USER}') THEN
    CREATE ROLE ${DB_RO_USER} LOGIN PASSWORD '${AGENT_RO_PASSWORD}';
  ELSE
    ALTER ROLE ${DB_RO_USER} WITH LOGIN PASSWORD '${AGENT_RO_PASSWORD}';
  END IF;
END
\$\$;
GRANT CONNECT ON DATABASE ${DB_NAME} TO ${DB_RO_USER};
\\c ${DB_NAME}
GRANT USAGE ON SCHEMA public TO ${DB_RO_USER};
GRANT SELECT ON ALL TABLES IN SCHEMA public TO ${DB_RO_USER};
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO ${DB_RO_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO ${DB_RO_USER};
ALTER ROLE ${DB_RO_USER} SET default_transaction_read_only = on;
SQL
    echo "RO role ${DB_RO_USER} ready on ${DB_NAME}"
  else
    echo "Skip RO role — set AGENT_RO_PASSWORD to create ${DB_RO_USER}"
  fi
else
  echo "psql not found — skip DB role"
fi

echo "==> SSH authorized_keys stub"
install -d -m 700 -o "$AGENT_USER" -g "$AGENT_USER" "/home/${AGENT_USER}/.ssh"
AUTH="/home/${AGENT_USER}/.ssh/authorized_keys"
if [[ ! -f "$AUTH" ]]; then
  cat >"$AUTH" <<'EOF'
# from="<madvillainy-tailscale-ip>",no-agent-forwarding,no-port-forwarding,no-X11-forwarding ssh-ed25519 AAAA... agent@madvillainy
EOF
  chown "$AGENT_USER:$AGENT_USER" "$AUTH"
  chmod 600 "$AUTH"
  echo "Edit $AUTH with the 1Password-backed agent key + from= restriction"
fi

cat <<EOF

Done. Next:
  1. Add agent pubkey to $AUTH with from= + no-agent-forwarding
  2. On madvillainy: Host bizarre-api-agent → ${AGENT_USER}@<CT103-IP> (see ssh-config.madvillainy.example)
  3. Before agent triage: on pve2 run  pct snapshot 103 pre-agent-\$(date +%F-%H%M)
  4. Confirm agent cannot: write $PROD_TREE, read $PROD_ENV, DROP tables (use ${DB_RO_USER})
  5. Never put pve2 in the SSH config Cursor's agent shell can read

EOF
