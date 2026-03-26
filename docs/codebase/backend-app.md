# Django project shell (`backend/src/app/`)

Django project package: settings, URL routing, WSGI/ASGI entrypoints. Default settings module is `app.settings` ([manage.py](../../backend/src/manage.py)).

For the `characters` app and API behavior, see [backend-characters-core.md](backend-characters-core.md) and [backend-characters-views.md](backend-characters-views.md). High-level narrative: [backend_documentation.md](../backend_documentation.md).

---

## [manage.py](../../backend/src/manage.py)

**Role:** Django CLI entry; sets `DJANGO_SETTINGS_MODULE` to `app.settings` unless overridden (e.g. `export DJANGO_SETTINGS_MODULE=app.settings_prod` for production).

**Typical use:** `python manage.py runserver`, `migrate`, `test`, `createsuperuser`.

---

## [settings.py](../../backend/src/app/settings.py)

**Role:** **Development** defaults.

| Area | Behavior |
|------|----------|
| `BASE_DIR` | `backend/src` (parent of `app/`) |
| `SECRET_KEY` | Hardcoded insecure key (dev only) |
| `DEBUG` | `True` |
| `ALLOWED_HOSTS` | localhost variants + ngrok free-tier suffixes |
| `DATABASES` | SQLite `db.sqlite3` under `backend/src/` |
| `INSTALLED_APPS` | `characters`, DRF, `rest_framework.authtoken`, `corsheaders`, Django contrib |
| `REST_FRAMEWORK` | Session + token auth; default permission `IsAuthenticated` |
| `CORS_ALLOWED_ORIGINS` | Local React, optional LAN IP, GitHub Pages frontend URL |
| `CORS_ALLOW_HEADERS` | Includes `ngrok-skip-browser-warning` for ngrok free tier |
| `MEDIA_ROOT` / `MEDIA_URL` | User-uploaded media under `backend/src/media` |
| `LOGGING` | Console + `debug.log` under `backend/src/` |

**Frontend impact:** Browser app must use an origin listed in `CORS_ALLOWED_ORIGINS` (or proxy) for credentialed requests. API base path is `/api/` (see urls).

---

## [settings_prod.py](../../backend/src/app/settings_prod.py)

**Role:** **Production** overrides via `from .settings import *`.

| Area | Behavior |
|------|----------|
| `DEBUG` | `False` |
| `SECRET_KEY` | `os.environ['SECRET_KEY']` |
| `ALLOWED_HOSTS` | Placeholder domains/IPs — must be filled for real deploy |
| `DATABASES` | PostgreSQL via `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT` |
| `CORS_ALLOWED_ORIGINS` | HTTPS production origins — must be filled |
| Security | SSL redirect, HSTS, secure cookies, `SECURE_PROXY_SSL_HEADER` for reverse proxy |
| `STATIC_ROOT` | `staticfiles/` for `collectstatic` |
| `LOGGING` | Rotating file under `logs/django.log` |
| Email | SMTP env vars for optional mail |

Use with `DJANGO_SETTINGS_MODULE=app.settings_prod` ([deploy-prod.sh](../../scripts/deploy-prod.sh) sets this).

---

## [urls.py](../../backend/src/app/urls.py)

**Role:** Root URLconf; mounts DRF `DefaultRouter` under **`/api/`**.

- **`path('', home)`** — Non-API home (view from `characters.views`).
- **`admin/`** — Django admin.
- **`api/`** — All `router.register(...)` resources (characters, campaigns, sessions, rolls, etc.). See router block in file for path names (`user-profiles`, `characters`, `sessions`, …).
- **Custom API paths:** `api/search/`, `api/get_available_playbook_abilities/`, `api/docs/`, `api/accounts/login/`, `api/accounts/signup/`, `api/accounts/me/`.
- **`static(MEDIA_URL, ...)`** — Serves media in development when `DEBUG` uses Django static helper.

**Note:** Imports duplicate `from django.contrib import admin` once; harmless. Nested routers are imported but router usage here is flat `DefaultRouter` only.

---

## [wsgi.py](../../backend/src/app/wsgi.py) / [asgi.py](../../backend/src/app/asgi.py)

**Role:** WSGI/ASGI application objects for production servers (e.g. **gunicorn** uses `app.wsgi:application` in [deploy-prod.sh](../../scripts/deploy-prod.sh)). Default settings module from env, else `app.settings`.

---

## API prefix summary

All REST resources and auth endpoints used by the React client are under **`/api/...`** (see [frontend.md](frontend.md) for how the client builds the base URL). Full route list lives in `urls.py` and generated router URLs.
