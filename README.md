# 1-800-BIZARRE

Monorepo for the **1-800-BIZARRE** TTRPG platform: a Django REST backend (`backend/`) and a React SPA frontend (`frontend/`) for the JoJo-flavored Bizarre tabletop ruleset.

Live site (GitHub Pages): <https://zoobavitel.github.io/1-800-BIZARRE/>

## Repo layout

| Path | What lives there |
|------|------------------|
| [`backend/`](backend/) | Django 4 + DRF API. Apps: `app/` (project), `characters/`, `authentication/`, `campaigns/`, `crews/`, `factions/`. |
| [`frontend/`](frontend/) | React 18 SPA built with `react-scripts` (CRA) + Tailwind. |
| [`docs/`](docs/) | Project docs, SRD markdown, codebase index. Start at [`docs/README.md`](docs/README.md). |
| [`scripts/`](scripts/) | Shell helpers + perf scripts (`scripts/perf/`). See [`scripts/README.md`](scripts/README.md). |
| [`deploy/`](deploy/) | Self-hosted LXC / Caddy / systemd templates. See [`deploy/bizarre-api/README.md`](deploy/bizarre-api/README.md). |
| [`.github/`](.github/) | Actions workflows + CI / deploy automation. See [`.github/README.md`](.github/README.md). |
| [`.cursor/`](.cursor/) | Cursor IDE rules, subagents, skills, plans. |

## Key root files

| File | Role |
|------|------|
| `package.json` | npm workspace root. Hosts `dev`, `test:*`, `lint`, `build`, `deploy`, `format` scripts that orchestrate frontend + backend. |
| `.venv/` | Python virtualenv used by `npm run dev:backend` and most scripts (`source .venv/bin/activate`). |
| `.eslintrc.json` | ESLint config (frontend lint). |
| `.prettierrc`, `.prettierignore` | Prettier config for `npm run format`. |
| `.gitleaks.toml` | Secret-scan rules used by `.github/workflows/secret-scan.yml`. |
| `BUGBOT.md` | Review standards for the critical-bug review bot. |
| `SECURITY.md` | Security policy / vulnerability reporting. |
| `MVP.md` | Historical MVP scope doc (not a living spec). |
| `tsconfig.json`, `tailwind.config.js`, `postcss.config.js` | Vestigial root configs — the live tooling lives under `frontend/`. Kept for IDE compatibility. |

## Getting started

```bash
git clone https://github.com/zoobavitel/1-800-BIZARRE.git
cd 1-800-BIZARRE

# Python venv at repo root
python -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt

# Node deps for frontend (npm workspace)
npm run install:all

# DB + fixtures
cd backend/src && python manage.py migrate
python manage.py loaddata characters/fixtures/*.json
cd ../..

# Run both servers
npm run dev          # frontend on :3000, Django on :8000
```

For the full local-dev walkthrough, CI parity, and deploy notes, see [`docs/development.md`](docs/development.md) and [`.github/README.md`](.github/README.md).

## Common commands

| Command | What it does |
|---------|--------------|
| `npm run dev` | Concurrently runs Django (`:8000`) + React (`:3000`). |
| `npm test` | Unit + integration suites (frontend Jest + backend Django). |
| `npm run test:automated-ui` | Playwright E2E (in `frontend/e2e/`). |
| `npm run test:performance` | Full A suite: latency + hot-path p95 + SSE gauge + Lighthouse. |
| `npm run test:performance:budget` | Blocking merge budgets (no Lighthouse). |
| `npm run test:load:saturday` | Staging Saturday capacity gate (target 10 concurrent). |
| `npm run lint` / `npm run lint:fix` | ESLint over `frontend/src/`. |
| `npm run format` / `format:check` | Prettier across the repo. |
| `npm run build` | Production frontend bundle (`frontend/build/`). |
| `npm run deploy` | `gh-pages` publish of `frontend/build` to GitHub Pages. |

## Game rules

The canonical ruleset lives in [`docs/1-(800)-BIZARRE SRD.md`](docs/1-\(800\)-BIZARRE%20SRD.md) (player-facing) and `docs/1-(800)-BIZARRE SRD_DEV.md` (work-in-progress). Backend validation should match the SRD; deviations are called out in PR descriptions per [`.cursor/rules/pr-doc-links-mechanics.mdc`](.cursor/rules/pr-doc-links-mechanics.mdc).
