#!/usr/bin/env bash
# Create a least-privilege "agent" user on CT 103 (bizarre-api) for Cursor triage.
#
# Roles (do not confuse names):
#   agent          — Unix SSH user for triage (this script). Not root, not deploy.
#   bizarre-deploy — CI deploy SSH user; owns /opt/bizarre-prod (git fetch/checkout).
#   bizarre_ro     — Postgres LOGIN role only (SELECT). Not a Unix account.
#
# Run as root INSIDE the container once:
#   bash /opt/bizarre/deploy/bizarre-api/setup-agent-user.sh
#   AGENT_RO_PASSWORD='…' bash /opt/bizarre/deploy/bizarre-api/setup-agent-user.sh
#
# Then install the agent's public key (local ed25519 on madvillainy) into
# ~agent/.ssh/authorized_keys with from="<madvillainy-tailscale-ip>",
# no-agent-forwarding,no-port-forwarding,no-X11-forwarding
#
# This script does NOT give write access to prod code, media, or prod.env.
# Fixes go through git → PR → deploy on madvillainy / agent tree.

set -euo pipefail

AGENT_USER="${AGENT_USER:-agent}"
DEPLOY_USER="${DEPLOY_USER:-bizarre-deploy}"
DEPLOY_GROUP="${DEPLOY_GROUP:-bizarre}"
PROD_TREE="${PROD_TREE:-/opt/bizarre-prod}"
MEDIA_ROOT="${MEDIA_ROOT:-/var/lib/bizarre}"
PROD_ENV="${PROD_ENV:-/etc/bizarre/prod.env}"
DB_NAME="${DB_NAME:-bizarre_db}"
DB_RO_USER="${DB_RO_USER:-bizarre_ro}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root inside CT 103" >&2
  exit 1
fi

echo "==> Create user ${AGENT_USER} (SSH triage shell)"
if ! id -u "$AGENT_USER" >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash "$AGENT_USER"
fi

echo "==> Groups for log reading (never add ${AGENT_USER} to ${DEPLOY_GROUP})"
getent group systemd-journal >/dev/null && usermod -aG systemd-journal "$AGENT_USER" || true
getent group adm >/dev/null && usermod -aG adm "$AGENT_USER" || true
# Ensure agent is not in the deploy group (write must stay owner-only for deploy)
if id -nG "$AGENT_USER" 2>/dev/null | tr ' ' '\n' | grep -qx "$DEPLOY_GROUP"; then
  gpasswd -d "$AGENT_USER" "$DEPLOY_GROUP" || true
fi

echo "==> Harden prod paths (deploy owns tree; agent no write; env 0640 root:bizarre)"
mkdir -p /etc/bizarre "$MEDIA_ROOT" "$PROD_TREE"
if [[ -f "$PROD_ENV" ]]; then
  # 0640 root:bizarre — deploy (group bizarre) can read for migrate; agent not in
  # that group so still cannot read secrets. Matches gunicorn.service install note.
  chown "root:${DEPLOY_GROUP}" "$PROD_ENV" || true
  chmod 640 "$PROD_ENV"
fi
# Prod tree + media: owner rwx; strip group/other write.
chmod -R u+rwX,go-w "$PROD_TREE" 2>/dev/null || true
chmod -R u+rwX,go-w "$MEDIA_ROOT" 2>/dev/null || true
# Keep CI deploy able to git fetch (owner write on .git); preserve setgid for group
if id -u "$DEPLOY_USER" >/dev/null 2>&1 && getent group "$DEPLOY_GROUP" >/dev/null; then
  chown -R "${DEPLOY_USER}:${DEPLOY_GROUP}" "$PROD_TREE" 2>/dev/null || true
  find "$PROD_TREE" -type d -exec chmod g+s {} + 2>/dev/null || true
fi

echo "==> sudoers: status/journal only (no restart)"
# PATH resolves to /usr/bin/*; trailing * allows --no-pager / -n N.
SUDOERS="/etc/sudoers.d/90-bizarre-agent"
cat >"$SUDOERS" <<EOF
# Managed by setup-agent-user.sh — agent triage only
Defaults:${AGENT_USER} !authenticate
${AGENT_USER} ALL=(root) NOPASSWD: /usr/bin/systemctl status gunicorn, /usr/bin/systemctl status gunicorn *, /usr/bin/systemctl status celery-worker, /usr/bin/systemctl status celery-worker *, /usr/bin/systemctl status caddy, /usr/bin/systemctl status caddy *, /usr/bin/systemctl status bizarre-*, /usr/bin/systemctl status bizarre-* *
${AGENT_USER} ALL=(root) NOPASSWD: /usr/bin/journalctl -u gunicorn, /usr/bin/journalctl -u gunicorn *, /usr/bin/journalctl -u celery-worker, /usr/bin/journalctl -u celery-worker *, /usr/bin/journalctl -u caddy, /usr/bin/journalctl -u caddy *, /usr/bin/journalctl -u bizarre-*, /usr/bin/journalctl -u bizarre-* *
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
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON SEQUENCES TO ${DB_RO_USER};
ALTER ROLE ${DB_RO_USER} SET default_transaction_read_only = on;
SQL
    echo "RO role ${DB_RO_USER} ready on ${DB_NAME}"
  else
    echo "Skip password create/reset — set AGENT_RO_PASSWORD to create/update ${DB_RO_USER}"
    if sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_RO_USER}'" | grep -q 1; then
      sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
GRANT CONNECT ON DATABASE ${DB_NAME} TO ${DB_RO_USER};
\\c ${DB_NAME}
GRANT USAGE ON SCHEMA public TO ${DB_RO_USER};
GRANT SELECT ON ALL TABLES IN SCHEMA public TO ${DB_RO_USER};
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO ${DB_RO_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO ${DB_RO_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON SEQUENCES TO ${DB_RO_USER};
ALTER ROLE ${DB_RO_USER} SET default_transaction_read_only = on;
SQL
      echo "Refreshed SELECT grants for existing ${DB_RO_USER}"
    fi
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
  echo "Edit $AUTH with the madvillainy agent pubkey + from= restriction"
fi

cat <<EOF

Done. Accounts:
  Unix triage:  ${AGENT_USER}  (no write on ${PROD_TREE}; no read ${PROD_ENV})
  Unix deploy:   ${DEPLOY_USER} (owns ${PROD_TREE}; CI LXC_SSH_USER)
  Postgres RO:   ${DB_RO_USER}  (LOGIN/SELECT only — not a shell user)

Next:
  1. Add agent pubkey to $AUTH with from= + no-agent-forwarding
  2. On madvillainy: Host bizarre-api-agent → ${AGENT_USER}@<CT103-IP> (see ssh-config.madvillainy.example)
  3. Before agent triage: on pve2 run  pct snapshot 103 pre-agent-\$(date +%F-%H%M)
  4. Confirm agent cannot: write $PROD_TREE, read $PROD_ENV, DROP tables (use ${DB_RO_USER})
  5. Never put pve2 in the SSH config Cursor's agent shell can read

EOF
