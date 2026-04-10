# Copilot cloud agent instructions (1-800-BIZARRE)

## What this repo is

**1-800-BIZARRE** is a monorepo for a full-stack web platform supporting a JoJo’s Bizarre Adventure–inspired TTRPG.

- **Frontend:** React (Create React App / `react-scripts`) in `frontend/`.
- **Backend:** Django + Django REST Framework in `backend/src/`.
- **Docs:** extensive SRD/rules + architecture notes in `docs/`.

Repo facts (as of 2026-04-10):
- Default branch: `master`.
- GitHub Pages site: `https://zoobavitel.github.io/1-800-BIZARRE/` (static frontend build).
- Primary languages: JavaScript/React and Python/Django.
- CI uses **Node 24** and **Python 3.11** (see `.github/workflows/ci.yml`).

## Golden rules (avoid CI failures)

1. **Follow CI, not local convenience.** Root `package.json` allows Node `>=18`, but **CI is Node 24**. Use Node 24 when validating changes.
2. **Always install deps exactly like CI before running checks:**
   - Node: `npm ci` from repo root.
   - Python: `python -m pip install --upgrade pip && pip install -r backend/requirements.txt`.
3. **Backend formatting is enforced in CI:** `Black` runs with `--check` on `backend/src`.
4. **Migrations are enforced in CI:** `python manage.py makemigrations --check --dry-run` must be clean.
5. **Integration tests require a running Django dev server** on `127.0.0.1:8000` and seeded fixtures.

If these instructions conflict with other docs, treat **GitHub Actions workflows** as authoritative.

## Repo layout (where to change things)

### Top-level
- `frontend/` – React app.
- `backend/` – backend dependencies + env template.
- `backend/src/` – Django project root (contains `manage.py`).
- `docs/` – developer docs + SRD/rules content.
- `scripts/` – shell scripts for setup and deployment.
- `.github/workflows/` – CI/CD definitions.

### Frontend highlights (`frontend/`)
- Entry point / main app logic: `frontend/src/index.js`.
- Feature areas: `frontend/src/components/`, `frontend/src/pages/`, `frontend/src/services/`, `frontend/src/utils/`.
- Integration tests live under `frontend/src/integration/` and are run via Jest with `--testPathPattern=integration` in CI.
- Environment:
  - `frontend/.env` sets `REACT_APP_API_URL=http://localhost:8000/api/` for local dev.
  - `frontend/.env.production` intentionally avoids baking localhost into production builds.

### Backend highlights (`backend/src/`)
- Django project settings/urls: `backend/src/app/`.
- Major apps include: `characters/`, `campaigns/`, `crews/`, `authentication/`, `factions/`.
- Tests exist under app-level test modules (example: `backend/src/characters/tests/`).
- Fixtures used in CI integration step: `backend/src/characters/fixtures/*.json`.

## How to build / test / lint (commands that match CI)

Run commands from the **repo root** unless noted.

### Bootstrap (clean, repeatable)

```bash
# optional but recommended when switching branches / debugging CI
npm run clean

# Node deps (uses root package-lock and npm workspaces)
npm ci

# Python deps
python -m pip install --upgrade pip
pip install -r backend/requirements.txt
```

Notes:
- Root `npm ci` installs workspace deps for `frontend/` via workspaces (no need to `cd frontend && npm install` for CI parity).
- Local development scripts may assume a venv exists; CI does not.

### Lint (frontend)

```bash
npm run lint
```

This maps to `cd frontend && npx eslint src/`.

### Format (frontend / general)

```bash
npm run format:check
# or to auto-fix
npm run format
```

### Test (frontend)

```bash
cd frontend
npm test -- --coverage --watchAll=false
```

### Test (backend)

```bash
export DJANGO_SETTINGS_MODULE=app.settings
cd backend/src
python manage.py test
python manage.py makemigrations --check --dry-run
```

### Integration tests (CI parity)

Precondition: Node deps + Python deps installed.

```bash
export DJANGO_SETTINGS_MODULE=app.settings
cd backend/src
python manage.py migrate
python manage.py loaddata characters/fixtures/*.json

# Run server in background
python manage.py runserver 127.0.0.1:8000 --noreload &
BACKEND_PID=$!
trap 'kill $BACKEND_PID 2>/dev/null || true' EXIT

# Wait for server
for i in $(seq 1 30); do
  if curl -sf "http://127.0.0.1:8000/" >/dev/null; then
    break
  fi
  sleep 1
done
curl -sf "http://127.0.0.1:8000/" >/dev/null

# Run only integration tests
cd ../../frontend
RUN_BACKEND_INTEGRATION=1 npm test -- --testPathPattern=integration --watchAll=false
```

Common failure modes:
- Port `8000` already in use.
- `curl` healthcheck fails because Django errors on `/`.
- Missing fixture data (always run `loaddata`).

### Build (frontend)

```bash
cd frontend
npm run build
```

GitHub Pages deploy job sets `REACT_APP_API_URL` from repo secrets before building.

## Local dev (fast path)

The simplest is to use the root scripts:

```bash
# frontend + backend concurrently
npm run dev
```

Notes:
- `npm run dev:backend` in root `package.json` expects a venv at **`.venv/`** in repo root (`source .venv/bin/activate`).
- `scripts/setup.sh` creates a venv at `backend/venv/` (different path). If you use `scripts/setup.sh`, either:
  - adjust the venv path to `.venv`, or
  - run Django commands by explicitly activating `backend/venv`.

## CI / checks overview (what runs in GitHub Actions)

From `.github/workflows/`:
- `ci.yml`:
  - `test-frontend`: `npm ci` → frontend tests → `npm run lint` → frontend build.
  - `test-backend`: pip install → Django tests → `makemigrations --check --dry-run`.
  - `integration-test`: install both → migrate + loaddata → runserver + curl wait → Jest integration tests.
  - `deploy-github-pages` (pushes to `master` only): builds and publishes `frontend/build`.
  - `deploy-lxc` (manual only): optional SSH/Tailscale deploy.
- `black.yml`: Black `--check` on `backend/src` (version pinned in workflow).

## When exploring / making changes

- Prefer targeted edits in the correct layer:
  - UI/UX and state: `frontend/src/`.
  - API, models, serializers, viewsets: `backend/src/`.
  - Cross-layer contracts: update both and add/adjust integration tests.
- Don’t search blindly first: **trust this file** for commands and locations. Only grep/search if instructions here are incomplete or demonstrably wrong.