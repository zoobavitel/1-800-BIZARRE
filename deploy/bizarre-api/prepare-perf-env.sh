#!/bin/bash
# Build /etc/bizarre/perf.env from prod.env without copying the live SECRET_KEY.
# Aborts if Redis database 2 is already the live or agent broker.
# See docs/TEST_PYRAMID.md
set -euo pipefail

PROD=${PROD_ENV:-/etc/bizarre/prod.env}
AGENT_ENV=${AGENT_ENV:-/opt/bizarre/backend/src/.env}
OUT=${PERF_ENV:-/etc/bizarre/perf.env}

if [[ ! -f "$PROD" ]]; then
  echo "missing $PROD" >&2
  exit 1
fi

index_of() {
  python3 - "$1" <<'PY'
import sys
from urllib.parse import urlparse
path = (urlparse(sys.argv[1] or "").path or "").strip("/")
print(path if path.isdigit() else "0")
PY
}

value_of() {
  local file="$1" key="$2"
  python3 - "$file" "$key" <<'PY'
import sys
path, key = sys.argv[1], sys.argv[2]
val = ""
with open(path, encoding="utf-8") as fh:
    for line in fh:
        if line.startswith(key + "="):
            val = line.split("=", 1)[1].strip().strip('"').strip("'")
print(val)
PY
}

live_url=$(value_of "$PROD" REDIS_URL)
live_i=$(index_of "${live_url:-redis://127.0.0.1:6379/0}")
agent_i=1
if [[ -f "$AGENT_ENV" ]]; then
  agent_url=$(value_of "$AGENT_ENV" REDIS_URL)
  if [[ -n "$agent_url" ]]; then
    agent_i=$(index_of "$agent_url")
  fi
fi

echo "live_broker_db=$live_i agent_broker_db=$agent_i perf_broker_db=2"
if [[ "$live_i" == "2" || "$agent_i" == "2" ]]; then
  echo "Refusing Redis db 2: it matches the live or agent broker." >&2
  exit 1
fi

python3 - "$PROD" "$OUT" <<'PY'
import secrets
import sys
from pathlib import Path

src, dest = Path(sys.argv[1]), Path(sys.argv[2])
drop_prefix = (
    "SECRET_KEY=",
    "DB_NAME=",
    "MEDIA_ROOT=",
    "REDIS_URL=",
    "CELERY_RESULT_BACKEND=",
    "REALTIME_REDIS_URL=",
    "EMAIL_BACKEND=",
    "EMAIL_HOST_USER=",
    "EMAIL_HOST_PASSWORD=",
    "REALTIME_CHANNEL_PREFIX=",
)
skip_words = ("SENTRY", "WEBHOOK", "BEAT")
kept = []
for line in src.read_text(encoding="utf-8").splitlines():
    upper = line.upper()
    if any(word in upper for word in skip_words):
        continue
    if line.startswith(drop_prefix):
        continue
    kept.append(line)
kept.extend(
    [
        "SECRET_KEY=" + secrets.token_urlsafe(48),
        "DB_NAME=jojo_ttrpg_perf",
        "MEDIA_ROOT=/var/lib/bizarre/perf-media",
        "REDIS_URL=redis://127.0.0.1:6379/2",
        "CELERY_RESULT_BACKEND=redis://127.0.0.1:6379/2",
        "REALTIME_REDIS_URL=redis://127.0.0.1:6379/2",
        "EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend",
        "EMAIL_HOST_USER=",
        "EMAIL_HOST_PASSWORD=",
        "REALTIME_CHANNEL_PREFIX=perf:bizarre:campaign:",
    ]
)
dest.write_text("\n".join(kept) + "\n", encoding="utf-8")
PY

chown root:bizarre "$OUT" 2>/dev/null || chown root:root "$OUT"
chmod 0640 "$OUT"
echo "wrote $OUT"
