#!/usr/bin/env bash
# Run on bizarre-api after PostgreSQL, Redis, prod venv, and /etc/bizarre/prod.env exist.
# Usage: bash /opt/bizarre-prod/deploy/bizarre-api/initial-deploy.sh
set -euo pipefail
ROOT="${ROOT:-/opt/bizarre-prod}"
export DJANGO_SETTINGS_MODULE="${DJANGO_SETTINGS_MODULE:-app.settings_prod}"
export BIZARRE_ENV_FILE="${BIZARRE_ENV_FILE:-/etc/bizarre/prod.env}"
cd "$ROOT/backend/src"
# shellcheck source=/dev/null
source "$ROOT/.venv/bin/activate"
python manage.py check
python manage.py migrate --noinput
python manage.py collectstatic --noinput
echo "Done. Create admin: python manage.py createsuperuser"
