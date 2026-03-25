#!/usr/bin/env bash
# Create a timestamped database backup (SQLite for app.settings, PostgreSQL for app.settings_prod).
# Uses: sqlite3 ".backup" (WAL-safe) or pg_dump -Fc.
#
# Environment:
#   DJANGO_SETTINGS_MODULE  default app.settings; use app.settings_prod for PostgreSQL
#   BACKUP_DIR              output directory (default: <repo>/backups)
#   DB_HOST DB_PORT DB_NAME DB_USER DB_PASSWORD  PostgreSQL (DB_PASSWORD also sets PGPASSWORD)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

DJANGO_SETTINGS_MODULE="${DJANGO_SETTINGS_MODULE:-app.settings}"
BACKUP_DIR="${BACKUP_DIR:-$REPO_ROOT/backups}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"

mkdir -p "$BACKUP_DIR"

is_postgres_settings() {
  case "$DJANGO_SETTINGS_MODULE" in
    *settings_prod) return 0 ;;
    *) return 1 ;;
  esac
}

backup_sqlite() {
  local db_path="$REPO_ROOT/backend/src/db.sqlite3"
  local out="$BACKUP_DIR/db-${TIMESTAMP}.sqlite3"
  if ! command -v sqlite3 >/dev/null 2>&1; then
    echo "❌ sqlite3 is not installed or not in PATH" >&2
    exit 1
  fi
  if [[ ! -f "$db_path" ]]; then
    echo "❌ SQLite database not found at $db_path" >&2
    exit 1
  fi
  # shellcheck disable=SC2016
  sqlite3 "$db_path" ".backup '$out'"
  echo "✅ Backup written: $out"
}

backup_postgres() {
  if ! command -v pg_dump >/dev/null 2>&1; then
    echo "❌ pg_dump is not installed or not in PATH" >&2
    exit 1
  fi
  local db_host="${DB_HOST:-localhost}"
  local db_port="${DB_PORT:-5432}"
  local db_name="${DB_NAME:-jojo_ttrpg}"
  local db_user="${DB_USER:-postgres}"
  export PGPASSWORD="${PGPASSWORD:-${DB_PASSWORD:-}}"
  if [[ -z "${PGPASSWORD}" ]]; then
    echo "❌ DB_PASSWORD or PGPASSWORD must be set for PostgreSQL backup" >&2
    exit 1
  fi
  local out="$BACKUP_DIR/db-${TIMESTAMP}.dump"
  pg_dump -h "$db_host" -p "$db_port" -U "$db_user" -Fc -f "$out" "$db_name"
  echo "✅ Backup written: $out"
}

if is_postgres_settings; then
  backup_postgres
else
  backup_sqlite
fi
