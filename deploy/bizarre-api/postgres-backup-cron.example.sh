#!/usr/bin/env bash
# Example: nightly pg_dump — install to /usr/local/bin, chmod +x, add cron:
# 0 3 * * * /usr/local/bin/postgres-backup-jojo.sh
set -euo pipefail
BACKUP_DIR="${BACKUP_DIR:-/var/backups/jojo-postgres}"
mkdir -p "$BACKUP_DIR"
STAMP=$(date +%Y%m%d-%H%M%S)
export PGPASSWORD="${DB_PASSWORD:?set DB_PASSWORD}"
pg_dump -h localhost -U "${DB_USER:-bizarre}" -Fc "${DB_NAME:-bizarre_db}" \
  >"$BACKUP_DIR/bizarre_db-${STAMP}.dump"
find "$BACKUP_DIR" -name 'bizarre_db-*.dump' -mtime +14 -delete
