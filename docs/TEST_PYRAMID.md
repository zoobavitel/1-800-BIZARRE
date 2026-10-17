# Test Pyramid

This project uses a four-layer test pyramid:

1. `unit`
2. `integration`
3. `automated-ui`
4. `manual`

Lower layers run more often and must stay fast. Top layer runs less often and focuses on release confidence.

## Command Matrix

| Layer | Scope | Command |
| --- | --- | --- |
| Unit | Pure logic and isolated API helpers | `npm run test:unit` |
| Integration | Frontend-backend contracts and core API flows | `npm run test:integration` |
| Automated UI | Browser smoke flows (login, character save) | `npm run test:automated-ui` |
| Manual | Release signoff protocol and evidence capture | `npm run test:manual` |
| Performance (budget) | Per-merge: root latency, roll/session p95, SSE open gauge | `npm run test:performance:budget` |
| Performance (Lighthouse) | Frontend budget (CI warn-only) | `npm run test:performance:lighthouse` |
| Performance (capacity) | Staging Saturday-table load (not every PR) | `npm run test:load:saturday` |

## Performance layers

### A — merge budgets (`test:performance:budget`)

- Root `GET /` latency smoke
- Authenticated **roll-action** + **session GET** p95
- **SSE gauge:** hold ≥5 concurrent streams, report `concurrent_open` + median lifetime, roll while streams are held

Requires a seeded API:

```bash
source .venv/bin/activate
cd backend/src
python manage.py seed_perf_tables --tier floor --reset --output /tmp/bizarre-perf-seed-floor.json
# API must be running (runserver or gunicorn twin)
PERF_SEED_JSON=/tmp/bizarre-perf-seed-floor.json npm run test:performance:budget
```

### B — Saturday capacity gate (manual / staging)

Realistic table play: long-lived SSE + idle silences + short roll bursts. **Not** continuous hammering.

| Tier | Concurrent players | Gate |
| --- | --- | --- |
| floor | 5 (1×5) | Must never degrade |
| target | 10 (2×5) | Must pass before SSE / gunicorn / advance-path deploys |
| stretch | 18 (3×6) | May be slow; must fail gracefully (recover within ~30s) |

```bash
python manage.py seed_perf_tables --tier target --reset --output /tmp/bizarre-perf-seed-target.json
# Prefer prod-like gunicorn: gthread, 2 workers, 32 threads — not runserver
PERF_SEED_JSON=/tmp/bizarre-perf-seed-target.json npm run test:load:saturday
PERF_LOAD_TIER=stretch PERF_SEED_JSON=/tmp/bizarre-perf-seed-stretch.json npm run test:load:saturday:stretch
```

**Hard ceiling:** each open SSE still pins one gunicorn gthread. Streams now cap at ~45s (`SSE_STREAM_MAX_SECONDS`) so worker recycles (`--max-requests` + jitter, `--graceful-timeout 60`) can drain. Ten simultaneous sheets still leave ~54 threads for HTTP across 2×32 until those streams close. If **target** fails under prod-like gunicorn, split SSE to a dedicated ASGI process before a third table.

Harnesses refuse known prod / Pages hosts unless `PERF_ALLOW_REMOTE=1` (staging only). The live Funnel host is refused unless the URL port is `8443` and `PERF_ALLOW_REMOTE=1`.

### C — Container probe (manual, not CI)

Public API stays Tailscale Funnel on port 443. This probe does not use ngrok or Cloudflare. It uses a second gunicorn on `127.0.0.1:8001` and database `jojo_ttrpg_perf`. Run it when nobody is playing.

On bizarre-api, as root:

```bash
bash deploy/bizarre-api/prepare-perf-env.sh
sudo -u postgres createdb -O bizarre jojo_ttrpg_perf
install -d -m 0750 -o root -g bizarre /var/lib/bizarre/perf-media
cd /opt/bizarre-prod/backend/src
export BIZARRE_ENV_FILE=/etc/bizarre/perf.env DJANGO_SETTINGS_MODULE=app.settings_prod
sudo -u postgres psql -tAc 'SHOW max_connections'
# Both stacks can open one connection per SSE stream. If max_connections is under 128, lower the perf unit threads before starting it.
../../.venv/bin/python manage.py migrate
../../.venv/bin/python manage.py seed_perf_tables --tier target --reset --output /root/bizarre-perf-seed.json
chmod 0600 /root/bizarre-perf-seed.json
cp deploy/bizarre-api/gunicorn-perf.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now gunicorn-perf
```

`prepare-perf-env.sh` prints the live and agent Redis database indexes and aborts if either is 2. Perf uses Redis database 2 and channel prefix `perf:bizarre:campaign:`.

Copy `/root/bizarre-perf-seed.json` to the harness machine over the LAN or the Proxmox console. Do not send it through Funnel.

Direct run, on the container, before Funnel port 8443 exists:

```bash
redis-cli PUBSUB CHANNELS '*' > /tmp/channels-before.txt
bash deploy/bizarre-api/sample-cgroup.sh /tmp/bizarre-perf-sample.csv &
# In another shell:
PERF_API_BASE_URL=http://127.0.0.1:8001 \
PERF_SEED_JSON=/root/bizarre-perf-seed.json \
PERF_ROLL_P95_MS=500 \
PERF_WARMUP_MS=15000 \
npm run test:load:saturday
redis-cli PUBSUB CHANNELS '*' > /tmp/channels-during.txt
```

New channels in the during list must start with `perf:`. A `bizarre:campaign:` name that was already in the before list is a live player, not a failure. The local Saturday gate stays at 1500 ms. This probe uses 500 ms.

`/api/` without a token returns 403. That means the perf server is up. `curl -f` treats 403 as a failure, so do not use it as the only health check.

gunicorn does not put `REDIS_URL` in the process environment. SSE reads `REALTIME_REDIS_URL`. That setting defaults to the Celery broker URL, so current env files stay on Redis. Set `REALTIME_REDIS_URL` when the broker leaves Redis. Without a Redis URL, both workers stay on in-process queues and a roll on one worker never reaches SSE on the other.

`sample-cgroup.sh` records `memory.current`, plus `anon` and `file` from `memory.stat`, and `SELECT count(*) FROM pg_stat_activity`. `anon` is the process memory. `file` is page cache. The 2271 MiB figure from the direct run was `memory.current`, so it includes page cache.

Direct target baseline, 2026-10-17, through an SSH tunnel to `127.0.0.1:8001`. Pass. 10 players, 2 minutes, 15 second warm-up. Roll p95 48.3 ms. Fanout p95 40.6 ms. One fanout delivery missed. SSE open at the end 10/10. 39 planned reconnects. Session p95 268.5 ms. Character p95 72.4 ms. Campaign p95 62.5 ms. Portrait p95 67.4 ms. During the run, Redis showed only `perf:bizarre:campaign:1` and `perf:bizarre:campaign:2`. On the earlier sample of this same build, container CPU peaked at 0.62 cores, cgroup memory peaked at 2271 MiB, perf gunicorn RSS peaked at 176 MiB, and Postgres RSS peaked at 315 MiB. `max_connections` is 100. Funnel port 8443 was not opened.

After that run is clean, open only port 8443 (`tailscale funnel --bg --https=8443 http://127.0.0.1:8001`). Confirm `tailscale funnel status` still sends 443 to port 8000. From a machine that is not on the tailnet:

```bash
PERF_ALLOW_REMOTE=1 \
PERF_API_BASE_URL=https://bizarre-api.tailb65341.ts.net:8443 \
PERF_SEED_JSON=/path/to/bizarre-perf-seed.json \
PERF_ROLL_P95_MS=500 \
PERF_WARMUP_MS=15000 \
npm run test:load:saturday
```

The gap between the two target runs is Funnel delay, including its fixed bandwidth limit. It is not a charge.

Soak, after both target runs pass: `PERF_LOAD_DURATION_MS=1800000` (30 minutes). Ramp: seed `--tier ramp`, then `PERF_LOAD_TIER=ramp PERF_LOAD_DURATION_MS=480000`. A planned SSE reconnect around 45 seconds is reported as `sse_reconnects` and is not a failure. A stream that is down at the end of the run is a failure.

No request in this mix waits on Celery. Tasks are not defined. If that changes, latencies for those calls will not match production, because nothing consumes Redis database 2.

Teardown:

```bash
CONFIRM=1 bash deploy/bizarre-api/teardown-perf.sh
```

Then delete the token file on the desktop and on the off-tailnet machine.

## CI Gate Policy

- Pull requests:
  - required: `unit`
  - required: `integration`
  - required: `automated-ui` smoke
  - required: performance **budget** (API + SSE gauge); Lighthouse warn-only
- Release/deploy:
  - required: `manual` signoff
  - required: performance budget evidence
  - required when touching SSE / gunicorn / advance / roll hot paths: Saturday **target** gate on staging

## Coverage Targets

- Frontend: Jest emits coverage when CI runs `npm test -- --coverage --watchAll=false`; global thresholds are off until unit coverage grows. Use `cd frontend && npm run test:coverage` locally. Playwright smoke specs live under `frontend/e2e/` so Jest (which only scans `src/`) does not pick them up.
- Backend coverage threshold enforced by `coverage report --fail-under` in root scripts.

## Critical Flow Coverage

Integration and automated-ui coverage should protect:

- Auth bootstrap (`signup/login/me`)
- Character lifecycle (`create/edit/delete`)
- Session roll loop (`roll-action`, session-linked roll history)
