# Copy dev data (SQLite) to production (PostgreSQL)

Use when you have a **local** `db.sqlite3` with data you want on **bizarre-api**.

## 1. Export (from dev machine, SQLite, `app.settings`)

```bash
cd backend/src
source ../../.venv/bin/activate  # or your venv
export DJANGO_SETTINGS_MODULE=app.settings
python manage.py dumpdata --natural-foreign --natural-primary \
  --exclude contenttypes --exclude auth.Permission \
  --indent 2 > /tmp/jojo-dump.json
```

Adjust `--exclude` if you need fewer tables.

## 2. Import (on server, Postgres, `app.settings_prod`)

Copy `jojo-dump.json` to the server, then:

```bash
cd /opt/bizarre/backend/src
source /opt/bizarre/.venv/bin/activate
export DJANGO_SETTINGS_MODULE=app.settings_prod
python manage.py loaddata /path/to/jojo-dump.json
```

Resolve any `IntegrityError` by loading order or trimming fixtures. For a **fresh** production DB, run **`migrate`** before **`loaddata`**.

## 3. Alternative: `pg_dump` + `pg_restore`

Only if you already have Postgres in dev and want a binary copy — not typical for SQLite.

See also [scripts/backup-database.sh](../scripts/backup-database.sh) for backup/restore patterns.
