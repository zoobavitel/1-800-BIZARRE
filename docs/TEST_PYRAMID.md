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
# Prefer prod-like gunicorn: gthread, 1 worker, 16 threads — not runserver
PERF_SEED_JSON=/tmp/bizarre-perf-seed-target.json npm run test:load:saturday
PERF_LOAD_TIER=stretch PERF_SEED_JSON=/tmp/bizarre-perf-seed-stretch.json npm run test:load:saturday:stretch
```

**Hard ceiling:** each SSE pins one gunicorn gthread. With `--workers 1 --threads 16`, ten open streams leave ~6 threads for all HTTP. Redis pub/sub enables multi-worker fanout later; it does **not** free SSE threads while `workers=1`. If **target** fails under prod-like gunicorn, multi-worker + Redis is required before a third table.

Harnesses refuse known prod / Pages hosts unless `PERF_ALLOW_REMOTE=1` (staging only).

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
