# GitHub configuration (`.github/`)

[![CI/CD Pipeline](https://github.com/zoobavitel/1-800-BIZARRE/actions/workflows/ci.yml/badge.svg)](https://github.com/zoobavitel/1-800-BIZARRE/actions/workflows/ci.yml)

This directory holds **GitHub Actions** automation for [1-800-BIZARRE](../README.md): continuous integration, optional **GitHub Pages** deploy for the static frontend, and an optional **SSH deploy** to a self-hosted API host. The main workflow is [workflows/ci.yml](workflows/ci.yml). For YAML-focused notes, see [workflows/README.md](workflows/README.md).

**Note:** The status badge above uses `zoobavitel/1-800-BIZARRE` (matches the [published GitHub Pages site](https://zoobavitel.github.io/1-800-BIZARRE/)). If your fork or upstream uses a different `owner/repo`, update the badge URLs accordingly.

## Contributing

Typical flow:

1. Fork the repository and create a branch for your change (see [docs/development.md](../docs/development.md) for local workflow).
2. Open a **pull request** against `master`. Those branches run the **CI/CD Pipeline** workflow on push and on PRs ([workflows/ci.yml](workflows/ci.yml)).
3. Address review feedback; keep CI green.

For full-stack local development (venv, migrate, `npm run dev`), use [docs/development.md](../docs/development.md). For day-to-day monorepo layout, see the root [README.md](../README.md).

## Prerequisites

To **match CI** as closely as possible:

- **Node.js** 24 (see `node-version` in [workflows/ci.yml](workflows/ci.yml))
- **Python** 3.11
- **npm** and **git**

**Tip:** Root [package.json](../package.json) lists `engines.node` as `>=18` for local convenience; CI is authoritative at **24**.

For a working backend locally, use a Python virtual environment. This repo’s root scripts expect a venv at **`.venv`** in the repository root (see `dev:backend` in [package.json](../package.json)), not only `backend/venv` as mentioned in some older docs.

## Reproducing CI locally

Run these from the **repository root** unless noted.

### Frontend job (`test-frontend`)

```bash
npm ci
cd frontend && npm test -- --coverage --watchAll=false
cd ..   # back to root
npm run lint
cd frontend && npm run build
```

### Backend job (`test-backend`)

```bash
python -m pip install --upgrade pip
pip install -r backend/requirements.txt
export DJANGO_SETTINGS_MODULE=app.settings
cd backend/src
python manage.py test
python manage.py makemigrations --check --dry-run
```

### Integration job (`integration-test`)

Requires both Node and Python dependencies installed (`npm ci` and `pip install -r backend/requirements.txt`), then:

```bash
export DJANGO_SETTINGS_MODULE=app.settings
cd backend/src
python manage.py migrate
python manage.py loaddata characters/fixtures/*.json
python manage.py runserver 127.0.0.1:8000 --noreload &
BACKEND_PID=$!
trap 'kill $BACKEND_PID 2>/dev/null || true' EXIT
for i in $(seq 1 30); do
  if curl -sf "http://127.0.0.1:8000/" >/dev/null; then
    break
  fi
  sleep 1
done
curl -sf "http://127.0.0.1:8000/" >/dev/null
cd ../../frontend
RUN_BACKEND_INTEGRATION=1 npm test -- --testPathPattern=integration --watchAll=false
```

**Note:** The integration step sets `RUN_BACKEND_INTEGRATION=1`, same as CI ([workflows/ci.yml](workflows/ci.yml)).

## Deployment (CI)

### GitHub Pages (static frontend)

After **integration tests** pass, job `deploy-github-pages` runs only on pushes to **`main`** or **`master`**. It builds with `npm ci` and `npm run build`, then publishes `frontend/build` (see [workflows/ci.yml](workflows/ci.yml)).

- Configure repository secret **`REACT_APP_API_URL`** so the production build points at your API.
- **Tip:** [package.json](../package.json) `homepage` controls the built asset base path for GitHub Pages.

### Optional LXC / SSH deploy (`deploy-lxc`)

Manual **workflow_dispatch** with input **`lxc_action`** set to **`deploy`** (still only on `main` / `master`). Choosing deploy is the signoff that manual release checks are done. Requires secrets **`LXC_SSH_HOST`**, **`LXC_SSH_USER`**, **`LXC_SSH_KEY`**, and a host **reachable from GitHub’s runners** (not only a private LAN IP unless you use Tailscale, port forwarding, or a self-hosted runner).

**Note:** GitHub-hosted runners cannot reach arbitrary private networks. See the comment block at the top of [workflows/ci.yml](workflows/ci.yml) and [deploy/bizarre-api/README.md](../deploy/bizarre-api/README.md) for manual deploy steps.

## Troubleshooting

- **Node or Python version drift:** CI uses Node **24** and Python **3.11**. Mismatch can cause “works locally, fails in CI” (or the reverse).
- **`makemigrations --check` fails:** Create and commit migrations, or fix model changes so no pending migrations exist.
- **Integration job fails on `curl` / server startup:** Port `8000` in use, slow startup, or backend error on `GET /`. Check logs from `runserver`.
- **GitHub Pages build:** Ensure **`REACT_APP_API_URL`** is set when the deploy job needs a real API URL.
- **SSH deploy:** Verify host reachability from the public internet and SSH key permissions.

More local setup detail: [docs/development.md](../docs/development.md). Broader documentation index: [docs/README.md](../docs/README.md).

## Thank you

Issues and pull requests help keep the platform and its automation healthy. Thanks for contributing.
