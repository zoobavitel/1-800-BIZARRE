#!/usr/bin/env bash
# Nightly Postgres + media backup for CT 103 (bizarre-api).
# Install:
#   sudo install -m 750 deploy/bizarre-api/postgres-media-backup.sh /usr/local/bin/bizarre-postgres-media-backup
#   sudo cp deploy/bizarre-api/bizarre-backup.timer deploy/bizarre-api/bizarre-backup.service /etc/systemd/system/
#   sudo systemctl daemon-reload && sudo systemctl enable --now bizarre-backup.timer
#
# Env (optional): BACKUP_DIR, DB_*, RETENTION_DAYS, MEDIA_ROOT
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/bizarre}"
MEDIA_ROOT="${MEDIA_ROOT:-/var/lib/bizarre/media}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
STAMP="$(date +%Y%m%d-%H%M%S)"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-bizarre_db}"
DB_USER="${DB_USER:-bizarre}"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

if [[ -z "${PGPASSWORD:-${DB_PASSWORD:-}}" ]]; then
  if [[ -f /etc/bizarre/prod.env ]]; then
    # shellcheck disable=SC1091
    set -a
    # Only pull DB_PASSWORD if present
    DB_PASSWORD="$(grep -E '^DB_PASSWORD=' /etc/bizarre/prod.env | head -1 | cut -d= -f2- | tr -d '"' || true)"
    set +a
    export PGPASSWORD="${DB_PASSWORD:?DB_PASSWORD required}"
  else
    echo "❌ Set DB_PASSWORD or PGPASSWORD (or provide /etc/bizarre/prod.env)" >&2
    exit 1
  fi
else
  export PGPASSWORD="${PGPASSWORD:-$DB_PASSWORD}"
fi

DUMP="$BACKUP_DIR/bizarre_db-${STAMP}.dump"
echo "→ pg_dump $DB_NAME → $DUMP"
pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -Fc -f "$DUMP" "$DB_NAME"
chmod 600 "$DUMP"

if [[ -d "$MEDIA_ROOT" ]]; then
  MEDIA_TAR="$BACKUP_DIR/media-${STAMP}.tar.gz"
  echo "→ tar media $MEDIA_ROOT → $MEDIA_TAR"
  tar -C "$(dirname "$MEDIA_ROOT")" -czf "$MEDIA_TAR" "$(basename "$MEDIA_ROOT")"
  chmod 600 "$MEDIA_TAR"
else
  echo "⚠ MEDIA_ROOT missing ($MEDIA_ROOT) — skipped"
fi

echo "→ prune dumps/tars older than ${RETENTION_DAYS}d"
find "$BACKUP_DIR" -type f \( -name 'bizarre_db-*.dump' -o -name 'media-*.tar.gz' \) -mtime "+$RETENTION_DAYS" -delete

echo "✅ Backup complete under $BACKUP_DIR"
ls -lt "$BACKUP_DIR" | head -8
