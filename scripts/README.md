# scripts/

Shell + Python + Node helper scripts for the 1-800-BIZARRE monorepo: setup, local dev, backup, deploy, daily bug review, and performance checks.

**Full write-up:** [`docs/codebase/scripts.md`](../docs/codebase/scripts.md) (purpose, usage, env vars, venv notes).

## Catalogue

| Script | Role |
|--------|------|
| [`setup.sh`](setup.sh) | First-time clone: installs root + frontend npm deps, creates a Python venv in `backend/venv`, runs `migrate` + `loaddata`, scaffolds `.env`. |
| [`start_dev.sh`](start_dev.sh) | Backgrounds Django + React dev servers; writes PIDs to `.dev_pids`. Activates `~/.virtualenvs/jojo`. |
| [`backup-database.sh`](backup-database.sh) | SQLite / Postgres snapshot into `backups/`. Used standalone or from `deploy-prod.sh`. |
| [`deploy-prod.sh`](deploy-prod.sh) | Full production deploy sequence: backup → migrate → collectstatic → tests → gunicorn restart. Requires env secrets. |
| [`production-deployment-checklist.sh`](production-deployment-checklist.sh) | Prints a release checklist; no side effects. |
| [`manual-release-signoff.sh`](manual-release-signoff.sh) | Walks an operator through manual release sign-off (called by `npm run test:manual` / `npm run test:acceptance`). |
| [`daily_critical_bug_review.py`](daily_critical_bug_review.py) | Cron-style daily review of recent commits / changes; consumed by [`.github/workflows/daily-critical-bug-review.yml`](../.github/workflows/daily-critical-bug-review.yml). |
| [`perf/api-latency-check.mjs`](perf/api-latency-check.mjs) | Root `GET /` latency smoke. Part of `npm run test:performance:budget`. |
| [`perf/hot-path-latency-check.mjs`](perf/hot-path-latency-check.mjs) | Authenticated roll-action + session GET p95 budgets. Needs `PERF_SEED_JSON`. |
| [`perf/sse-concurrency-check.mjs`](perf/sse-concurrency-check.mjs) | Hold ≥5 SSE streams; gauge open count + median lifetime; roll under load. |
| [`perf/saturday-table.mjs`](perf/saturday-table.mjs) | Staging capacity gate: realistic idle+burst with live SSE (floor/target/stretch). |
| [`perf/k6/saturday-table.js`](perf/k6/saturday-table.js) | Optional k6 roll-burst twin (no SSE hold); prefer `saturday-table.mjs`. |
| [`perf/lighthouse-budget-check.mjs`](perf/lighthouse-budget-check.mjs) | Lighthouse run against the built frontend with budget assertions defined in [`perf/lighthouse-budget.json`](perf/lighthouse-budget.json). |
| [`perf/perf-common.mjs`](perf/perf-common.mjs) | Shared helpers; refuses prod/Pages hosts unless `PERF_ALLOW_REMOTE=1`. |

## ⚠ Venv path inconsistency

Three different venv conventions exist in the repo today; pick the one that matches your entry point:

| Convention | Used by |
|------------|---------|
| **`.venv/` at repo root** (canonical) | Root `package.json` (`dev:backend`, `test:*:backend`), `.github/workflows/ci.yml`, Cursor rules, [`docs/development.md`](../docs/development.md). |
| `backend/venv/` | `setup.sh` (legacy first-run path). |
| `~/.virtualenvs/jojo/` | `start_dev.sh` (legacy). |

If you bootstrap a fresh clone, prefer `python -m venv .venv` at the repo root; CI and most npm scripts assume that path. The `setup.sh` / `start_dev.sh` paths are kept for backward compatibility and could be unified in a future cleanup.

## Conventions

- Bash scripts: `set -e`; print a one-line purpose comment at the top with a doc-pointer (most do — e.g. `# See docs/codebase/scripts.md#<anchor>`).
- New automation belongs here or under [`backend/src/characters/management/commands/`](../backend/src/characters/management/commands/) — not as ad-hoc files at the repo root.
