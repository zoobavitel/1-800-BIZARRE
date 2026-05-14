# backend/

Django 4 + Django REST Framework API for the 1-800-BIZARRE platform. Serves all character, NPC, crew, campaign, session, and reference data consumed by the React frontend.

## Layout

| Path | Role |
|------|------|
| [`src/`](src/) | Django project root. Contains `manage.py` and all installed apps: `app/` (settings, URLs, WSGI/ASGI, Celery), `characters/`, `authentication/`, `campaigns/`, `crews/`, `factions/`. |
| [`requirements.txt`](requirements.txt) | Runtime + dev Python dependencies. |
| [`requirements-prod.txt`](requirements-prod.txt) | Additional production dependencies (gunicorn, psycopg, etc.). |
| [`.env.example`](.env.example) | Template for the `.env` file consumed by `python-decouple`. Copy to `backend/src/.env` for local dev and to `/opt/bizarre/backend/src/.env` on prod. |
| `package.json`, `package-lock.json`, `node_modules/` | **Vestigial** — leftover Tailwind 4 / react-router-dom deps not used by Django. Safe to ignore; do not add backend-side Node code here. |

## Quick start

```bash
# From repo root, with the shared .venv activated
source .venv/bin/activate
pip install -r backend/requirements.txt

cd backend/src
python manage.py migrate
python manage.py loaddata characters/fixtures/*.json
python manage.py runserver
```

The repo-root convention is a single venv at `../.venv` (see root `package.json` → `dev:backend`). Don't create a `backend/venv` — older docs that mention it are stale.

## Apps

| App | Purpose |
|-----|---------|
| `app/` | Django project (`settings.py`, `settings_prod.py`, `urls.py`, `wsgi.py`, `asgi.py`, `celery.py`, `api_exceptions.py`). |
| `characters/` | Core game data: `Character`, `Stand`, `Heritage`, `Ability`, `Trauma`, NPCs, Sessions, Rolls, services, DRF views. **Most game logic lives here.** See [`src/characters/README.md`](src/characters/README.md). |
| `authentication/` | Login / signup / profile endpoints (split out from `characters.views.auth_views`). |
| `campaigns/`, `crews/`, `factions/` | Newer per-domain apps split out as the project grew. |

## Tests

```bash
source .venv/bin/activate
cd backend/src
python manage.py test                 # full suite
python manage.py test characters      # one app
coverage run --source=characters manage.py test && coverage report
```

CI runs the same suite plus `makemigrations --check --dry-run` (see [`.github/workflows/ci.yml`](../.github/workflows/ci.yml)).

## Deployment

Production deploy templates (gunicorn, Celery, Caddy, systemd, Postgres) live under [`../deploy/bizarre-api/`](../deploy/bizarre-api/). The `app.settings_prod` module is selected via `DJANGO_SETTINGS_MODULE=app.settings_prod`.

## Where to read more

- [`docs/backend_documentation.md`](../docs/backend_documentation.md) — narrative architecture overview.
- [`docs/codebase/backend-app.md`](../docs/codebase/backend-app.md), [`backend-characters-core.md`](../docs/codebase/backend-characters-core.md), [`backend-characters-views.md`](../docs/codebase/backend-characters-views.md), [`backend-commands.md`](../docs/codebase/backend-commands.md) — implementation maps.
- [`docs/1-(800)-BIZARRE SRD.md`](../docs/1-\(800\)-BIZARRE%20SRD.md) — game rules backend validation must match.
