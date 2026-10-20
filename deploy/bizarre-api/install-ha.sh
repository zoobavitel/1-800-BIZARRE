#!/usr/bin/env bash
# Move prod off the single gunicorn master onto a two-instance floor.
# bizarre-lb then owns 127.0.0.1:8000, which is what Funnel already targets.
#
# Run as root on CT 103, after deploy-lxc has put this tree on
# /opt/bizarre-prod, and while nobody is playing. The cutover stops the live
# gunicorn for as long as it takes Caddy to bind :8000.
#
#   BIZARRE_HA_CUTOVER=1 bash /opt/bizarre-prod/deploy/bizarre-api/install-ha.sh
#
# If the new pool does not answer, this script starts the old gunicorn again.

set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root inside CT 103." >&2
  exit 1
fi

if [[ "${BIZARRE_HA_CUTOVER:-}" != "1" ]]; then
  echo "Refusing to cut over. This stops the live API on port 8000." >&2
  echo "Run between sessions:" >&2
  echo "  BIZARRE_HA_CUTOVER=1 bash /opt/bizarre-prod/deploy/bizarre-api/install-ha.sh" >&2
  exit 1
fi

PROD_ROOT="${PROD_ROOT:-/opt/bizarre-prod}"
UNIT_DIR="${PROD_ROOT}/deploy/bizarre-api"
PY="${PROD_ROOT}/.venv/bin/python"

if [[ ! -x "$PY" ]]; then
  echo "Missing $PY. Deploy the prod tree first." >&2
  exit 1
fi
if ! command -v caddy >/dev/null; then
  echo "Missing caddy. Install it before the cutover." >&2
  exit 1
fi

echo "Installing pool units."
install -m 0644 "${UNIT_DIR}/gunicorn@.service" /etc/systemd/system/gunicorn@.service
install -m 0644 "${UNIT_DIR}/bizarre-lb.service" /etc/systemd/system/bizarre-lb.service
install -m 0644 "${UNIT_DIR}/bizarre-scale.service" /etc/systemd/system/bizarre-scale.service
install -m 0644 "${UNIT_DIR}/bizarre-scale.timer" /etc/systemd/system/bizarre-scale.timer
# CI deploys run the root-owned copy. Refresh it so deploys roll the pool.
install -m 0755 -o root -g root "${UNIT_DIR}/apply-units.sh" /usr/local/sbin/bizarre-apply-units
install -d -m 0750 -o root -g bizarre /etc/bizarre /run/bizarre
"$PY" "${UNIT_DIR}/ha_scale_run.py" render 1,2 /etc/bizarre/lb.caddy
systemctl daemon-reload

echo "Starting floor instances on 8001 and 8002. The live master stays on 8000."
systemctl enable gunicorn@1 gunicorn@2
systemctl restart gunicorn@1 gunicorn@2

if ! "$PY" - <<'PY'
import urllib.request
for port in (8001, 8002):
    with urllib.request.urlopen("http://127.0.0.1:%d/api/health/" % port, timeout=3) as response:
        if response.status != 200:
            raise SystemExit("health on %d returned %s" % (port, response.status))
PY
then
  echo "Floor health failed. Leaving the live gunicorn on 8000." >&2
  systemctl disable --now gunicorn@1 gunicorn@2 || true
  exit 1
fi

echo "Stopping the single gunicorn master and binding the load balancer to 8000."
systemctl disable --now gunicorn
if ! systemctl enable --now bizarre-lb; then
  echo "Load balancer failed to start. Restoring the single gunicorn master." >&2
  systemctl disable --now bizarre-lb || true
  systemctl enable --now gunicorn
  systemctl disable --now gunicorn@1 gunicorn@2 || true
  exit 1
fi

if ! "$PY" - <<'PY'
import urllib.request
with urllib.request.urlopen("http://127.0.0.1:8000/api/health/", timeout=3) as response:
    if response.status != 200:
        raise SystemExit("lb health returned %s" % response.status)
PY
then
  echo "Load balancer health failed. Restoring the single gunicorn master." >&2
  systemctl disable --now bizarre-lb || true
  systemctl enable --now gunicorn
  systemctl disable --now gunicorn@1 gunicorn@2 || true
  exit 1
fi

systemctl enable --now bizarre-scale.timer
echo "Pool is up. Floor instances 1 and 2. Scaler may add 3 and 4."
echo "Celery stays a single worker. Postgres and Redis stay on this container."
