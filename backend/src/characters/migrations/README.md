# backend/src/characters/migrations/

Standard Django migration history for the `characters` app (~90 migrations and counting).

## Conventions

- Run `python manage.py makemigrations` whenever you change `models.py`; commit the generated file.
- CI fails on `python manage.py makemigrations --check --dry-run` drift — never merge with uncommitted schema changes.
- When deleting / renaming a model or field that already shipped, prefer additive migrations + data migrations over destructive squashes; the prod DB is Postgres and can't be reset.
- Migration filenames stay auto-generated (`NNNN_<short_name>.py`). Don't rename them.

For impact analysis before / after model changes, the `django-schema-impact` Cursor subagent traces models → serializers → views → frontend API helpers.

See also: [`docs/codebase/backend-characters-core.md`](../../../../docs/codebase/backend-characters-core.md) for the model map.
