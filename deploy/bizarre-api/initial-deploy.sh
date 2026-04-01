#!/usr/bin/env bash
# Run on bizarre-api after PostgreSQL, Redis, venv, and .env exist.
# Usage: from repo root on server, e.g. bash deploy/bizarre-api/initial-deploy.sh
set -euo pipefail
ROOT="${ROOT:-/opt/bizarre}"
export DJANGO_SETTINGS_MODULE="${DJANGO_SETTINGS_MODULE:-app.settings_prod}"
cd "$ROOT/backend/src"
# shellcheck source=/dev/null
source "$ROOT/.venv/bin/activate"
python manage.py check
python manage.py migrate --noinput
python manage.py collectstatic --noinput
echo "Done. Create admin: python manage.py createsuperuser"
