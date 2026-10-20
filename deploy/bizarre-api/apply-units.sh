#!/usr/bin/env bash
# Apply a deploy to the running API without dropping requests.
#
# CI runs this as root through sudo, after it has checked out the new code in
# /opt/bizarre-prod. setup-deploy-sudo.sh installs a root-owned copy at
# /usr/local/sbin/bizarre-apply-units; the deploy user cannot edit that copy.
#
# 1. Install gunicorn.service / celery-worker.service from the prod tree when
#    they differ from /etc/systemd/system, then daemon-reload.
# 2. gunicorn: reload (HUP). The master keeps its listening socket, starts
#    workers on the new code, then lets the old ones finish their requests.
#    Players see no connection errors. A full restart happens only when the
#    gunicorn unit itself changed (its command-line flags), or when gunicorn
#    is not running.
# 3. celery-worker: restart. It serves no HTTP, so players do not notice.
# 4. Wait until 127.0.0.1:8000 answers again.

set -euo pipefail

PROD_ROOT=/opt/bizarre-prod
SRC="$PROD_ROOT/deploy/bizarre-api"
DEST=/etc/systemd/system
gunicorn_unit_changed=0
reloaded_daemon=0

install_unit() {
  local name="$1"
  if ! cmp -s "$SRC/$name" "$DEST/$name"; then
    install -m 644 -o root -g root "$SRC/$name" "$DEST/$name"
    echo "Installed $name"
    reloaded_daemon=1
    if [ "$name" = gunicorn.service ]; then
      gunicorn_unit_changed=1
    fi
  fi
}

install_unit gunicorn.service
install_unit celery-worker.service
if [ "$reloaded_daemon" = 1 ]; then
  systemctl daemon-reload
fi

if [ "$gunicorn_unit_changed" = 1 ] || ! systemctl is-active --quiet gunicorn; then
  echo "gunicorn unit changed or not running: full restart (brief outage)."
  systemctl restart gunicorn
else
  echo "gunicorn: graceful reload (no outage)."
  systemctl reload gunicorn
fi

systemctl restart celery-worker || true

# Any HTTP status means gunicorn is answering. Connection errors mean it is not.
for _ in $(seq 1 60); do
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 http://127.0.0.1:8000/api/campaigns/ || true)"
  if [ -n "$code" ] && [ "$code" != 000 ] && [ "$code" -lt 500 ]; then
    echo "API answering (HTTP $code)."
    exit 0
  fi
  sleep 2
done
echo "API did not answer on 127.0.0.1:8000 within 120s." >&2
systemctl status gunicorn --no-pager -l | tail -n 30 >&2 || true
exit 1
