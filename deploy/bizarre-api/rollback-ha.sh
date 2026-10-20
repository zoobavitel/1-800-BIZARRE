#!/usr/bin/env bash
# Put the single gunicorn master back on 127.0.0.1:8000.
# Run as root on CT 103 between sessions.
#
#   BIZARRE_HA_ROLLBACK=1 bash /opt/bizarre-prod/deploy/bizarre-api/rollback-ha.sh

set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root inside CT 103." >&2
  exit 1
fi

if [[ "${BIZARRE_HA_ROLLBACK:-}" != "1" ]]; then
  echo "Refusing to roll back. This stops the pool and binds gunicorn to port 8000." >&2
  echo "  BIZARRE_HA_ROLLBACK=1 bash /opt/bizarre-prod/deploy/bizarre-api/rollback-ha.sh" >&2
  exit 1
fi

systemctl disable --now bizarre-scale.timer || true
systemctl disable --now bizarre-lb
systemctl enable --now gunicorn
systemctl stop gunicorn@4 gunicorn@3 gunicorn@2 gunicorn@1 || true
systemctl disable gunicorn@1 gunicorn@2 || true

python3 - <<'PY'
import urllib.request
with urllib.request.urlopen("http://127.0.0.1:8000/api/health/", timeout=3) as response:
    if response.status != 200:
        raise SystemExit("restored gunicorn health returned %s" % response.status)
PY
echo "Single gunicorn master is back on 8000."
