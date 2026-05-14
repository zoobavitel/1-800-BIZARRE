# backend/src/

Django project root: `app/` (settings, URLs, WSGI/ASGI), Django apps (`characters/`, etc.), and `manage.py`.

**Maintenance:** use `python manage.py <command>` with commands from `characters/management/commands/`, or shell scripts under repo `scripts/` (see `docs/codebase/scripts.md`).

Do not add one-off `.py` files here; use management commands or `scripts/` so behavior stays discoverable.
