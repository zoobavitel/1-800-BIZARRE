# bizarre-api (Proxmox LXC) deployment

Paths assume clone at `/opt/bizarre` and venv at `/opt/bizarre/.venv`.

## Getting code onto the CT (you usually do **not** need rsync)

- **Normal path:** `git clone` / `git pull` from GitHub on the container (what `/opt/bizarre` is for). Push from your dev machine, pull on the server — no rsync.
- **Use rsync (or `scp`) only if:** you have **uncommitted** changes you refuse to push yet, a **private** fork you do not want on GitHub, or you are copying **data** (e.g. `db.sqlite3`, media) — not the whole tree every time.

After pull on the server, reinstall deps if `requirements*.txt` changed: `pip install -r backend/requirements.txt` and `pip install -r backend/requirements-prod.txt`.

## MVP testing (before and after migration)

**Before cutover (on your dev machine):** run the full backend test suite and a production frontend build. In Cursor you can use the **test-runner-django-frontend** subagent, which runs the same checks as [.cursor/rules/pr-before-build.mdc](../../.cursor/rules/pr-before-build.mdc): `python manage.py test` from `backend/src` (with venv) and `npm run build` for the frontend.

**After deploy (on bizarre-api):** from `/opt/bizarre/backend/src` with `DJANGO_SETTINGS_MODULE=app.settings_prod`, run `python manage.py check` and `python manage.py test` (Postgres must be up). Then smoke-test the live app: GitHub Pages → **Game server URL** with your public API base ending in `/api`.

Re-run the same **post-migration** checks after any change that affects rolls, sessions, or API contracts.

## 1. Environment

Copy [`env.example`](env.example) to `/opt/bizarre/backend/src/.env` and set `SECRET_KEY`, `DB_PASSWORD`, and comma-separated `ALLOWED_HOSTS` / `CORS_ALLOWED_ORIGINS` (include `https://zoobavitel.github.io` for GitHub Pages).

## 2. Django (check, migrate, static, superuser)

```bash
bash /opt/bizarre/deploy/bizarre-api/initial-deploy.sh
cd /opt/bizarre/backend/src && source /opt/bizarre/.venv/bin/activate
python manage.py createsuperuser
```

## 3. systemd

**Paths:** Unit files live under **`/opt/bizarre/deploy/bizarre-api/`** (repo root), not under `backend/src`. If you `cd` into `backend/src`, relative `deploy/...` will fail — always use the absolute paths below.

```bash
sudo cp /opt/bizarre/deploy/bizarre-api/gunicorn.service /etc/systemd/system/
sudo cp /opt/bizarre/deploy/bizarre-api/celery-worker.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now gunicorn celery-worker
sudo systemctl status gunicorn celery-worker --no-pager
```

Units rely on **`WorkingDirectory=/opt/bizarre/backend/src`** so **python-decouple** loads `.env` there. Do not use `EnvironmentFile=` for `.env` in systemd: it mangles values containing **`$`**, which breaks `SECRET_KEY` and DB passwords.

Adjust `User=` / paths if you run as non-root.

## 4. Caddy

```bash
sudo cp /opt/bizarre/deploy/bizarre-api/Caddyfile.example /etc/caddy/Caddyfile
# Edit domain, then:
sudo systemctl reload caddy
```

## 5. Firewall (example, ufw)

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

Do not expose PostgreSQL (5432) or Redis (6379) publicly.

## 6. Pi-hole

Local DNS: `bizarre-api` → `192.168.1.204` (or your CT IP).

## 7. SQLite → Postgres (optional)

From a dev machine with SQLite data, see [../../docs/DEPLOY_SQLITE_TO_POSTGRES.md](../../docs/DEPLOY_SQLITE_TO_POSTGRES.md).

## 8. Tailscale (optional)

Install Tailscale on the CT for tailnet access; use **Funnel** or **Serve** for a public HTTPS URL, then add that hostname to `ALLOWED_HOSTS` and `CORS_ALLOWED_ORIGINS`.

## 9. Backups

See [`postgres-backup-cron.example.sh`](postgres-backup-cron.example.sh). Take a Proxmox snapshot before major upgrades.
