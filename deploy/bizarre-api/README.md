# bizarre-api (Proxmox LXC) deployment

## Two trees + shared host paths

| Path | Role |
|------|------|
| `/opt/bizarre` | **Agent / ops workspace.** Any branch, dirty OK. Cursor agents work here. Never point gunicorn here. |
| `/opt/bizarre-prod` | **Production code checkout.** Detached at `origin/master` (or a rollback SHA). Own venv. |
| `/etc/bizarre/prod.env` | **Single prod secrets file.** Units + `BIZARRE_ENV_FILE`. Not under either git tree. |
| `/var/lib/bizarre/media` | **Prod uploads (MEDIA_ROOT).** Outside git — safe from `git clean`. |

### Why the code split is not enough

Gunicorn must not serve agent WIP — that is the code split. Agents must also **not share the prod database by default**. If `/opt/bizarre/backend/src/.env` still points at `bizarre_db`, then `manage.py migrate` on a feature branch migrates live prod before that code is deployed. Default agent setup:

- On `/opt/bizarre`, `manage.py` defaults to `app.settings_agent` (CI/local use `app.settings`; prod units set `app.settings_prod`)
- `DB_NAME=bizarre_db_dev` (snapshot; see `bootstrap-agent-dev-db.sh`)
- Redis DB index `1` (prod uses `0`)

Touching live data (mid-session restore) requires **`ALLOW_PROD_DB=1`** plus `DB_NAME` set to prod — otherwise `settings_agent` raises `ImproperlyConfigured`. Stronger optional layer: Postgres role for agents with no `CONNECT` on the prod DB.

### One-time cutover (between sessions)

Do **not** stop gunicorn until step 6.

1. **Bootstrap prod tree + rsync media (copy, not move):**
   ```bash
   bash /opt/bizarre/deploy/bizarre-api/bootstrap-prod-tree.sh
   ```
2. **Agent dev DB snapshot:**
   ```bash
   bash /opt/bizarre/deploy/bizarre-api/bootstrap-agent-dev-db.sh
   cp /opt/bizarre/deploy/bizarre-api/agent.env.example /opt/bizarre/backend/src/.env
   # set DB_PASSWORD; confirm DB_NAME=bizarre_db_dev
   ```
3. **Install units + Caddy** (media root → `/var/lib/bizarre/media`):
   ```bash
   sudo cp /opt/bizarre-prod/deploy/bizarre-api/gunicorn.service /etc/systemd/system/
   sudo cp /opt/bizarre-prod/deploy/bizarre-api/celery-worker.service /etc/systemd/system/
   # edit /etc/caddy/Caddyfile media root (see Caddyfile.example)
   sudo systemctl daemon-reload
   sudo systemctl restart gunicorn celery-worker
   sudo systemctl reload caddy
   ```
4. **Verify:** log in, open a campaign with images, upload a portrait, confirm a celery task runs.
5. **Final media rsync** (cutover only — **not** part of CI deploy):
   ```bash
   rsync -a /opt/bizarre/backend/src/media/ /var/lib/bizarre/media/
   # After things look good for a few days, remove the old tree copy so agents
   # cannot pollute prod media:
   # rm -rf /opt/bizarre/backend/src/media
   ```
6. Leave `/opt/bizarre` alone for a few days — rollback is reverting the unit files + Caddy media path.

Confirm host wiring after install:

```bash
grep -r /opt/bizarre /etc   # expect agent paths gone from gunicorn/celery/caddy
# prod clone can git fetch (same credentials as agent remote)
# deploy pip installs into /opt/bizarre-prod/.venv only
```

### Ongoing deploys

Manual GitHub Actions `workflow_dispatch` → `deploy-lxc` (must run on `master`). Remote script (`set -euo pipefail` inside SSH):

1. Abort if `/opt/bizarre-prod` or `/etc/bizarre/prod.env` missing, or prod tree dirty (`git status --porcelain`).
2. `git fetch` + `git checkout --detach origin/master`.
3. pip into **prod** venv / migrate / collectstatic / restart units.

Fail loud. No `reset --hard`, no `clean -fd`, no checkout of `/opt/bizarre`, no media rsync from the agent tree (that is cutover-only).

Rollback of live code: `cd /opt/bizarre-prod && git fetch origin && git checkout --detach <sha>` then restart gunicorn/celery.

---

## Getting code onto the CT

- **Prod:** CI detach-checkout (or manual detach in `/opt/bizarre-prod`). Merge to `master` first.
- **Agent:** any branch in `/opt/bizarre`; does not update live API.
- **rsync/scp:** data only (DB dumps, media) — not the whole app tree every time.

## MVP testing

**Before cutover:** full backend tests + frontend build (see [.cursor/rules/pr-before-build.mdc](../../.cursor/rules/pr-before-build.mdc)).

**After deploy:** from `/opt/bizarre-prod/backend/src` with `DJANGO_SETTINGS_MODULE=app.settings_prod` and `BIZARRE_ENV_FILE=/etc/bizarre/prod.env`, run `python manage.py check`. Smoke-test GitHub Pages → public API `/api`.

## 1. Environment

| File | Purpose |
|------|---------|
| [`env.example`](env.example) → `/etc/bizarre/prod.env` | Production only (mode `0640`) |
| [`agent.env.example`](agent.env.example) → `/opt/bizarre/backend/src/.env` | Agent Postgres clone |

Do **not** keep a second `.env` under `/opt/bizarre-prod`. Units set **only** `BIZARRE_ENV_FILE=/etc/bizarre/prod.env` (no `EnvironmentFile=` — that would inject values into `os.environ` and let systemd-mangled `$` override decouple). Install the file `0640 root:root` (or `root:<service-user>`). Missing file → Django/decouple fail at startup rather than silently using empty defaults.

## 2. Django (check, migrate, static, superuser)

```bash
bash /opt/bizarre-prod/deploy/bizarre-api/initial-deploy.sh
cd /opt/bizarre-prod/backend/src && source /opt/bizarre-prod/.venv/bin/activate
export BIZARRE_ENV_FILE=/etc/bizarre/prod.env DJANGO_SETTINGS_MODULE=app.settings_prod
python manage.py createsuperuser
```

### Reference data

```bash
cd /opt/bizarre-prod/backend/src && source /opt/bizarre-prod/.venv/bin/activate
export BIZARRE_ENV_FILE=/etc/bizarre/prod.env DJANGO_SETTINGS_MODULE=app.settings_prod
python manage.py load_srd_reference_data
```

## 3. systemd

```bash
sudo cp /opt/bizarre-prod/deploy/bizarre-api/gunicorn.service /etc/systemd/system/
sudo cp /opt/bizarre-prod/deploy/bizarre-api/celery-worker.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now gunicorn celery-worker
sudo systemctl status gunicorn celery-worker --no-pager
```

## 4. Caddy

```bash
sudo cp /opt/bizarre-prod/deploy/bizarre-api/Caddyfile.example /etc/caddy/Caddyfile
# Edit domain; media root must be /var/lib/bizarre/media
sudo systemctl reload caddy
```

Back up `/var/lib/bizarre/media` with the database — Postgres dumps do not contain uploads.

**Ngrok:** agent ngrok against `/opt/bizarre` + `settings_agent` is separate from prod Caddy → gunicorn.

## 5. Firewall / Pi-hole / Tailscale / SQLite migration / backups

Unchanged in spirit — see prior sections. Postgres backups: [`postgres-backup-cron.example.sh`](postgres-backup-cron.example.sh). Include `/var/lib/bizarre/media` in host backups. Take a Proxmox snapshot before major upgrades.
