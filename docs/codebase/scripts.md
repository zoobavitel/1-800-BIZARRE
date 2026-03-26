# Shell scripts (`scripts/`)

Operational scripts for setup, local dev, backups, and production deploy. Detailed narrative lives here; [scripts/README.md](../../scripts/README.md) is a short index.

For game rules, see [1(800)-Bizarre SRD.md](../1(800)-Bizarre%20SRD.md). For backend architecture overview, see [backend_documentation.md](../backend_documentation.md).

## Conventions

- Run scripts from the **repository root** unless noted.
- **Venv mismatch:** [setup.sh](../../scripts/setup.sh) creates `backend/venv`. Root [package.json](../../package.json) `dev:backend` uses `.venv` at repo root (per project conventions). [start_dev.sh](../../scripts/start_dev.sh) uses `~/.virtualenvs/jojo`. Pick one venv and align paths when debugging imports.

---

## [setup.sh](../../scripts/setup.sh)

**Purpose:** First-time (or clean) dev environment: Node deps, frontend deps, Python venv under `backend/`, `pip install`, SQLite migrations, fixture load, optional `backend/.env` from `.env.example`.

**When to use:** New clone; after wiping `backend/venv` or DB.

**Usage:**

```bash
./scripts/setup.sh
```

**Prerequisites:** `node`, `python3`, `git` on PATH.

**Notes:** Creates `backend/venv` (not `.venv` at root). Loads `characters/fixtures/*.json`. Suggests `npm run dev` afterward.

---

## [start_dev.sh](../../scripts/start_dev.sh)

**Purpose:** Launch Django `runserver` and React `npm start` in the **background**, write PIDs to `.dev_pids` at repo root.

**When to use:** Alternative to `npm run dev` if you want the same pattern (two background processes + PID file). **Not** the same venv as `npm run dev` (see below).

**Usage:**

```bash
./scripts/start_dev.sh
```

**Prerequisites:** Venv at `~/.virtualenvs/jojo/bin/activate` (hardcoded). Adjust script or symlink if you use `.venv` or `backend/venv`.

**Ports:** Backend `http://127.0.0.1:8000`, frontend `http://localhost:3000`.

**Stop:** `kill $(cat .dev_pids)` (as printed).

---

## [backup-database.sh](../../scripts/backup-database.sh)

**Purpose:** Timestamped backup — **SQLite** when `DJANGO_SETTINGS_MODULE` is default `app.settings`, **PostgreSQL** (`pg_dump -Fc`) when module name contains `settings_prod`.

**When to use:** Before migrations or deploy; manual safety copy. Invoked by [deploy-prod.sh](../../scripts/deploy-prod.sh) before `migrate`.

**Usage:**

```bash
# Dev SQLite (default)
./scripts/backup-database.sh

# Production Postgres
export DJANGO_SETTINGS_MODULE=app.settings_prod
export DB_HOST DB_PORT DB_NAME DB_USER DB_PASSWORD  # as needed
./scripts/backup-database.sh
```

**Environment:**

| Variable | Role |
|----------|------|
| `DJANGO_SETTINGS_MODULE` | `app.settings` (default) → SQLite; `app.settings_prod` → Postgres |
| `BACKUP_DIR` | Output dir (default: `<repo>/backups`) |
| `DB_*` / `PGPASSWORD` | Postgres connection (see script) |

**Outputs:** `backups/db-YYYYMMDD-HHMMSS.sqlite3` or `.dump`.

---

## [deploy-prod.sh](../../scripts/deploy-prod.sh)

**Purpose:** Production-oriented sequence: require `SECRET_KEY` and `DB_PASSWORD`, set `DJANGO_SETTINGS_MODULE=app.settings_prod`, install `requirements-prod.txt`, run [backup-database.sh](../../scripts/backup-database.sh), `migrate`, `collectstatic`, idempotent Django `admin` superuser, `manage.py test`, then **gunicorn** on `0.0.0.0:8000`.

**When to use:** Server deploy workflows that match this script’s assumptions (not GitHub Pages-only frontends).

**Usage:** Export secrets first, then run from repo root:

```bash
export SECRET_KEY=...
export DB_PASSWORD=...
./scripts/deploy-prod.sh
```

**Prerequisites:** PostgreSQL reachable with env from [settings_prod](../../backend/src/app/settings_prod.py); `gunicorn` installed via prod requirements.

**Caveat:** Creates superuser `admin` with placeholder password if missing — change immediately in real production.

---

## [production-deployment-checklist.sh](../../scripts/production-deployment-checklist.sh)

**Purpose:** **Interactive checklist printer** (echoes sections: security, DB, API, frontend, performance, testing, monitoring, rollback). Does not change system state.

**When to use:** Human pre-flight before a release; copy/paste reminders for curl checks and deploy commands.

**Usage:**

```bash
./scripts/production-deployment-checklist.sh
```

**Note:** Example `curl` URLs and paths are placeholders (`yourdomain.com`, `/path/to/production/...`).
