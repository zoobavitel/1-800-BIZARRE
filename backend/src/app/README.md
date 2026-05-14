# backend/src/app/

Django project package: settings, URL routing, WSGI/ASGI entry points, Celery wiring, and global API exception handling.

| File | Role |
|------|------|
| [`settings.py`](settings.py) | Development settings. `INSTALLED_APPS`, DRF config, `corsheaders`, SQLite default, token auth. |
| [`settings_prod.py`](settings_prod.py) | Production overrides — Postgres via `python-decouple`, security headers, `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`. Activated with `DJANGO_SETTINGS_MODULE=app.settings_prod`. |
| [`urls.py`](urls.py) | Root URL conf. Mounts the DRF router under `/api/` and the Django admin under `/admin/`. |
| [`wsgi.py`](wsgi.py) | WSGI entrypoint used by gunicorn in production. |
| [`asgi.py`](asgi.py) | ASGI entrypoint (used by any async features / SSE views in `characters/views_sse.py`). |
| [`celery.py`](celery.py) | Celery app definition for the `celery-worker` systemd unit (see [`deploy/bizarre-api/`](../../../deploy/bizarre-api/)). |
| [`api_exceptions.py`](api_exceptions.py) | Custom DRF exception handler wired via `REST_FRAMEWORK['EXCEPTION_HANDLER']`. |
| `__init__.py` | Loads Celery on Django startup. |

## Notes

- **Environment loading**: settings use `python-decouple`; on production we rely on `WorkingDirectory=/opt/bizarre/backend/src` so `.env` is picked up. Avoid `EnvironmentFile=` in systemd — it mangles `$` characters in secrets.
- **API root**: every API path lives under `/api/...`. Routers are registered in [`characters/views/`](../characters/views/) and the sibling apps (`authentication`, `campaigns`, `crews`, `factions`).

For an annotated walkthrough, see [`docs/codebase/backend-app.md`](../../../docs/codebase/backend-app.md).
