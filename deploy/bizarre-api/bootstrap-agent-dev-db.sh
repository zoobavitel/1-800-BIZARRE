#!/usr/bin/env bash
# Create / refresh bizarre_db_dev as a snapshot of the production DB for agents.
# Does not touch gunicorn. Requires peer/local Postgres access as a superuser or
# a role that can CREATE DATABASE.
#
# Usage:
#   PROD_DB=bizarre_db DEV_DB=bizarre_db_dev bash deploy/bizarre-api/bootstrap-agent-dev-db.sh
set -euo pipefail

PROD_DB="${PROD_DB:-bizarre_db}"
DEV_DB="${DEV_DB:-bizarre_db_dev}"
DB_USER="${DB_USER:-bizarre}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"

export PGHOST="$DB_HOST"
export PGPORT="$DB_PORT"

echo "Snapshot $PROD_DB → $DEV_DB (owner $DB_USER)"

if psql -U postgres -tAc "SELECT 1 FROM pg_database WHERE datname='${DEV_DB}'" | grep -q 1; then
  echo "Dropping existing $DEV_DB (terminate backends first)"
  psql -U postgres -v ON_ERROR_STOP=1 <<SQL
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${DEV_DB}' AND pid <> pg_backend_pid();
DROP DATABASE ${DEV_DB};
SQL
fi

psql -U postgres -v ON_ERROR_STOP=1 <<SQL
CREATE DATABASE ${DEV_DB} OWNER ${DB_USER};
SQL

pg_dump -U postgres --no-owner --no-acl "$PROD_DB" | psql -U postgres -v ON_ERROR_STOP=1 "$DEV_DB"

psql -U postgres -v ON_ERROR_STOP=1 <<SQL
ALTER DATABASE ${DEV_DB} OWNER TO ${DB_USER};
SQL

echo "Done. Agent .env should use DB_NAME=${DEV_DB} with DJANGO_SETTINGS_MODULE=app.settings_agent"
echo "Refresh this snapshot whenever you need a new copy of prod data for repro."
