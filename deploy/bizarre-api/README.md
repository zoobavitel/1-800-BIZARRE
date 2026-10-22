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
3. pip into **prod** venv / migrate / collectstatic.
4. `sudo /usr/local/sbin/bizarre-apply-units` (`apply-units.sh`): installs changed `gunicorn.service` / `celery-worker.service`, **reloads** gunicorn (HUP, no dropped requests), restarts celery, waits for `127.0.0.1:8000`. Gunicorn is fully restarted only when its unit file changed. If the helper is not installed yet, CI falls back to `systemctl restart` and warns.

The job refuses to run Mon 7:45–10:30pm ET (game session) unless dispatched with `allow_during_session`.

One-time root setup for step 4 (re-run when `apply-units.sh` changes):

```bash
bash /opt/bizarre-prod/deploy/bizarre-api/setup-deploy-sudo.sh
```

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

Do **not** keep a second `.env` under `/opt/bizarre-prod`. Units set **only** `BIZARRE_ENV_FILE=/etc/bizarre/prod.env` (no `EnvironmentFile=` — that would inject values into `os.environ` and let systemd-mangled `$` override decouple). Install `/etc/bizarre` as `0750 root:bizarre` and `prod.env` as `0640 root:bizarre`, and ensure CI deploy user (`bizarre-deploy` / `LXC_SSH_USER`) is in group `bizarre` so migrate can read secrets (gunicorn as root still works; triage `agent` must stay out of that group). Missing or unreadable file → Django/decouple fail at startup rather than silently using empty defaults.

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

Public path: **Cloudflare Tunnel (`api.1-800-bizarre.com`) → Caddy `127.0.0.1:8080` → gunicorn `127.0.0.1:8000`**. Tailscale Funnel (`bizarre-api.<tailnet>.ts.net`) points at the same Caddy port and is the fallback. Cloudflare and Funnel terminate TLS. Caddy compresses JSON, serves `/media/` from disk with cache headers, and streams SSE through unbuffered. If Funnel points straight at `:8000`, there's no compression, and every portrait ties up a gunicorn thread.

Do this between sessions:

```bash
sudo cp /opt/bizarre-prod/deploy/bizarre-api/Caddyfile.example /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl enable --now caddy   # or: sudo systemctl reload caddy
# Expect 200 and Content-Encoding on a JSON response. Needs a token (Caddy
# compresses bodies over 512 bytes; a 401 is too small) and X-Forwarded-Proto
# (without it Django answers 301 to https). Do not paste the token anywhere.
cd /opt/bizarre-prod/backend/src && source /opt/bizarre-prod/.venv/bin/activate
export BIZARRE_ENV_FILE=/etc/bizarre/prod.env DJANGO_SETTINGS_MODULE=app.settings_prod
T=$(python manage.py shell -c "from rest_framework.authtoken.models import Token; print(Token.objects.first().key)" | tail -1)
curl -sI -H "Authorization: Token $T" -H 'X-Forwarded-Proto: https' -H 'Accept-Encoding: gzip' http://127.0.0.1:8080/api/abilities/ | grep -iE '^HTTP|content-encoding'
sudo tailscale funnel --bg http://127.0.0.1:8080
sudo tailscale funnel status   # expect: / proxy http://127.0.0.1:8080
```

Rollback: `sudo tailscale funnel --bg http://127.0.0.1:8000`. CI deploys don't touch Caddy, Funnel or the tunnel.

### Cloudflare Tunnel

Why: the Funnel name is under `*.ts.net`. Any device with Tailscale on resolves it to the CT's private `100.x` address, so it skips Funnel, goes over a DERP relay when away from home, and browsers block it as a local-network request. `api.1-800-bizarre.com` resolves publicly for everyone, VPN on or off.

The tunnel `bizarre-api` is remotely managed (ingress lives in Cloudflare, not on the CT):

- Ingress: `api.1-800-bizarre.com` → `http://127.0.0.1:8080`, catch-all `http_status:404`.
- DNS: proxied CNAME `api` → `<tunnel-id>.cfargotunnel.com`.
- Zone: Bot Fight Mode off (API calls must never get a challenge page); cache rule bypasses cache for the API host.

Connector on the CT (Debian):

```bash
sudo mkdir -p --mode=0755 /usr/share/keyrings
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main' | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt-get update && sudo apt-get install -y cloudflared
sudo cloudflared service install <TUNNEL_TOKEN>   # token: cf tunnels token get <tunnel-id>
systemctl status cloudflared --no-pager
```

`prod.env` must list `api.1-800-bizarre.com` in `ALLOWED_HOSTS`. `cloudflared` keeps the original Host header, so portrait URLs built with `build_absolute_uri()` use the public host. SSE is fine through Cloudflare: heartbeats every 15s and streams end within 55s, well under Cloudflare's 100s idle limit.

### Persistent logs

The gunicorn access log records each URL with its duration. Keep it across reboots so you can profile game nights:

```bash
# /etc/systemd/journald.conf
#   Storage=persistent
#   SystemMaxUse=500M
sudo systemctl restart systemd-journald
```

Rank endpoints by total server time, for example the morning after a session:

```bash
journalctl -u gunicorn --since "<date> 23:30" --until "<next date> 03:00" -o cat | awk '$NF ~ /ms$/ {split($3,u,"?"); p=u[1]; gsub(/[0-9]+/,":id",p); ms=$NF; sub(/ms/,"",ms); n[p]++; t[p]+=ms; b[p]+=$(NF-1)} END {for (p in n) printf "%8d %10.0fms %6.0favg %8.1fMB %s\n", n[p], t[p], t[p]/n[p], b[p]/1e6, p}' | sort -k2 -nr | head -25
```

Back up `/var/lib/bizarre/media` with the database — Postgres dumps do not contain uploads.

**Ngrok:** agent ngrok against `/opt/bizarre` + `settings_agent` is separate from prod Caddy → gunicorn.

## 5. Firewall / Pi-hole / Tailscale / SQLite migration / backups

Nightly DB+media: [`postgres-media-backup.sh`](postgres-media-backup.sh) + `bizarre-backup.timer` → `/var/backups/bizarre`.
PBS host backup (on pve2): [`pbs-ct-backup.example.md`](pbs-ct-backup.example.md).
Restore drill: [`restore-drill.sh`](restore-drill.sh).
Vault copy of `prod.env`: [`copy-prod-env-to-vault.sh`](copy-prod-env-to-vault.sh).

Full policy: [`docs/operations/backup-policy.md`](../../docs/operations/backup-policy.md).

## 6. Agent triage (least privilege)

Cursor may SSH into this CT for debug — as user `agent`, not as the app user and never via pve2 host SSH.

- One-time: [`setup-agent-user.sh`](setup-agent-user.sh) (RO Postgres role, sudoers status/journal only, harden `prod.env`)
- Dev box SSH fragment: [`ssh-config.madvillainy.example`](ssh-config.madvillainy.example)
- Ops narrative: [`docs/operations/agent-safety.md`](../../docs/operations/agent-safety.md)
- Project hooks (agent tree `/opt/bizarre` only): [`.cursor/hooks.json`](../../.cursor/hooks.json)
- Hooks must be `root`-owned with no group/other write so `agent` cannot rewrite tripwires
