#!/usr/bin/env bash
# One-time (or repair) setup: prod clone + external media + single prod.env.
# Does NOT stop gunicorn. Safe to run before cutover (rsync copy, not move).
#
# Usage (on bizarre-api, between sessions for the final unit swap):
#   bash /opt/bizarre/deploy/bizarre-api/bootstrap-prod-tree.sh
set -euo pipefail

AGENT_ROOT="${AGENT_ROOT:-/opt/bizarre}"
PROD_ROOT="${PROD_ROOT:-/opt/bizarre-prod}"
PROD_ENV_FILE="${PROD_ENV_FILE:-/etc/bizarre/prod.env}"
MEDIA_ROOT_HOST="${MEDIA_ROOT_HOST:-/var/lib/bizarre/media}"
AGENT_ENV_EXAMPLE="${AGENT_ROOT}/deploy/bizarre-api/agent.env.example"

if [ ! -d "$AGENT_ROOT/.git" ]; then
  echo "Expected agent git clone at $AGENT_ROOT" >&2
  exit 1
fi

REMOTE_URL="$(git -C "$AGENT_ROOT" remote get-url origin)"

if [ ! -d "$PROD_ROOT/.git" ]; then
  echo "Cloning $REMOTE_URL → $PROD_ROOT"
  git clone "$REMOTE_URL" "$PROD_ROOT"
else
  echo "Prod clone already exists at $PROD_ROOT"
fi

cd "$PROD_ROOT"
git fetch origin
git checkout --detach origin/master

if [ ! -x "$PROD_ROOT/.venv/bin/python" ]; then
  echo "Creating venv at $PROD_ROOT/.venv"
  python3 -m venv "$PROD_ROOT/.venv"
fi
# shellcheck source=/dev/null
source "$PROD_ROOT/.venv/bin/activate"
pip install -q -U pip
pip install -q -r "$PROD_ROOT/backend/requirements.txt"
pip install -q -r "$PROD_ROOT/backend/requirements-prod.txt"

# --- single prod env (not under either git tree) ---
install -d -m 0750 /etc/bizarre
if [ ! -f "$PROD_ENV_FILE" ]; then
  LEGACY_ENV="$AGENT_ROOT/backend/src/.env"
  if [ -f "$LEGACY_ENV" ]; then
    echo "Installing $PROD_ENV_FILE from legacy agent .env (review MEDIA_ROOT / secrets)"
    cp -a "$LEGACY_ENV" "$PROD_ENV_FILE"
  else
    echo "Installing $PROD_ENV_FILE from env.example — fill SECRET_KEY / DB_PASSWORD"
    cp -a "$PROD_ROOT/deploy/bizarre-api/env.example" "$PROD_ENV_FILE"
  fi
  # Ensure MEDIA_ROOT points outside git trees
  if ! grep -q '^MEDIA_ROOT=' "$PROD_ENV_FILE"; then
    printf '\nMEDIA_ROOT=%s\n' "$MEDIA_ROOT_HOST" >>"$PROD_ENV_FILE"
  else
    # Rewrite in-tree media paths to the external host path
    sed -i "s|^MEDIA_ROOT=.*|MEDIA_ROOT=${MEDIA_ROOT_HOST}|" "$PROD_ENV_FILE"
  fi
  chmod 0640 "$PROD_ENV_FILE"
  chown root:root "$PROD_ENV_FILE" 2>/dev/null || true
else
  echo "Prod env already at $PROD_ENV_FILE"
fi

# Do NOT leave a second copy under the prod git tree (drift risk).
rm -f "$PROD_ROOT/backend/src/.env"

# --- media: copy (rsync), never move, while old gunicorn still serves agent path ---
install -d -m 0755 "$MEDIA_ROOT_HOST"
AGENT_MEDIA="$AGENT_ROOT/backend/src/media"
if [ -d "$AGENT_MEDIA" ]; then
  echo "rsync media $AGENT_MEDIA/ → $MEDIA_ROOT_HOST/"
  rsync -a "$AGENT_MEDIA/" "$MEDIA_ROOT_HOST/"
else
  echo "No agent media dir at $AGENT_MEDIA (ok if already external)"
fi

# --- agent workspace: refuse-by-default prod DB (settings_agent) ---
AGENT_ENV="$AGENT_ROOT/backend/src/.env"
if [ -f "$AGENT_ENV" ]; then
  if grep -qE '^DB_NAME=(bizarre_db|jojo_ttrpg)\s*$' "$AGENT_ENV" \
    && ! grep -qE '^ALLOW_PROD_DB=(1|true|True|yes)\s*$' "$AGENT_ENV"; then
    echo "WARNING: $AGENT_ENV still uses a production-like DB_NAME without ALLOW_PROD_DB=1." >&2
    echo "  manage.py on /opt/bizarre loads settings_agent and will refuse to start." >&2
    echo "  Point DB_NAME at bizarre_db_dev (agent.env.example) or set ALLOW_PROD_DB=1 deliberately." >&2
    echo "  Optional: bash $AGENT_ROOT/deploy/bizarre-api/bootstrap-agent-dev-db.sh" >&2
  fi
elif [ -f "$AGENT_ENV_EXAMPLE" ]; then
  echo "No agent .env — copy agent.env.example → $AGENT_ENV and set DB_PASSWORD"
fi

OWNER="${PROD_TREE_OWNER:-root}"
chown -R "$OWNER:$OWNER" "$PROD_ROOT" 2>/dev/null || true

echo
echo "Bootstrap prepared (gunicorn not restarted)."
echo "Cutover checklist (between sessions):"
echo "  1. bash $AGENT_ROOT/deploy/bizarre-api/bootstrap-agent-dev-db.sh   # once"
echo "  2. Point agent .env at bizarre_db_dev (agent.env.example); use settings_agent"
echo "  3. sudo cp $PROD_ROOT/deploy/bizarre-api/gunicorn.service /etc/systemd/system/"
echo "  4. sudo cp $PROD_ROOT/deploy/bizarre-api/celery-worker.service /etc/systemd/system/"
echo "  5. Point Caddy media root at $MEDIA_ROOT_HOST"
echo "  6. sudo systemctl daemon-reload && sudo systemctl restart gunicorn celery-worker"
echo "  7. Verify login, campaign images, upload, celery"
echo "  8. rsync -a $AGENT_MEDIA/ $MEDIA_ROOT_HOST/   # catch stragglers"
echo "  9. Leave $AGENT_ROOT alone for a few days (rollback = old unit files)"
echo
echo "Deploy uses only $PROD_ROOT + $PROD_ENV_FILE + $MEDIA_ROOT_HOST."
