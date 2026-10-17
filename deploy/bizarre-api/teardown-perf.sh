#!/bin/bash
# Remove the perf probe. Does not touch Funnel port 443 or the live database.
# See docs/TEST_PYRAMID.md
set -euo pipefail

if [[ "${CONFIRM:-}" != "1" ]]; then
  echo "Refusing teardown. Re-run with CONFIRM=1 after the load test." >&2
  exit 1
fi

echo "--- funnel before ---"
tailscale funnel status || true

# Drop only the 8443 listener. `tailscale funnel off` would also drop 443.
tailscale funnel --https=8443 off || true

systemctl disable --now gunicorn-perf.service || true
systemctl is-active gunicorn-perf.service && echo "gunicorn-perf still active" >&2 && exit 1 || true

live_i=$(python3 - <<'PY'
from pathlib import Path
from urllib.parse import urlparse
text = Path("/etc/bizarre/prod.env").read_text(encoding="utf-8")
url = "redis://127.0.0.1:6379/0"
for line in text.splitlines():
    if line.startswith("REDIS_URL="):
        url = line.split("=", 1)[1].strip()
path = (urlparse(url).path or "").strip("/")
print(path if path.isdigit() else "0")
PY
)
if [[ "$live_i" == "2" ]]; then
  echo "Refusing FLUSHDB 2: live broker uses database 2." >&2
  exit 1
fi
redis-cli -n 2 FLUSHDB

if sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='jojo_ttrpg_perf'" | grep -q 1; then
  sudo -u postgres dropdb jojo_ttrpg_perf
fi

rm -rf /var/lib/bizarre/perf-media
rm -f /etc/bizarre/perf.env /root/bizarre-perf-seed.json

echo "--- funnel after ---"
tailscale funnel status || true
echo "Confirm 443 still points at 127.0.0.1:8000 and 8443 is absent."
echo "Delete the token copies on the desktop and the off-tailnet machine."
