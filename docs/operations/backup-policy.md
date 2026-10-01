# Backup policy (production)

Goal: if an agent (or human) wrecks CT 103, restore is boring — not a Reddit post.

## What must be backed up

| Asset | Why |
|-------|-----|
| Postgres (`bizarre_db`) | Campaign / character / session state |
| `/var/lib/bizarre/media` | Uploads — **not** in `pg_dump` |
| Code | Git remote + optional pull-mirror (Forgejo/Gitea) |
| Secrets | `/etc/bizarre/prod.env` — offline / password manager, **not** in agent-reachable paths |

## Current repo tooling

| Mechanism | Role |
|-----------|------|
| [`scripts/backup-database.sh`](../../scripts/backup-database.sh) | On-demand / pre-deploy dump (`deploy-prod.sh` aborts if this fails) |
| [`postgres-backup-cron.example.sh`](../../deploy/bizarre-api/postgres-backup-cron.example.sh) | Example nightly `pg_dump -Fc` → `/var/backups/jojo-postgres`, delete `>14` days |

**Gap to close on the host:** confirm cron/timer actually runs; add **media** tarball beside DB; move retention **off-host** so the agent cannot delete backups.

## Target policy

1. **Nightly (prod host → off-host)**
   - `pg_dump -Fc` of prod DB
   - tarball or `restic` snapshot of `/var/lib/bizarre/media`
   - Prefer **Proxmox Backup Server** or restic/borg with **append-only** / object-lock credentials the agent does not have

2. **Retention**
   - Daily ≥14 days on PBS/restic
   - Optional monthly keep

3. **Pre-change**
   - `pct snapshot 103 …` before agent triage or major upgrades
   - Snapshots live on same storage — **not** a substitute for PBS

4. **Deploy**
   - Keep `deploy-prod.sh` pre-migrate DB backup

5. **Verify**
   - Check newest dump/media backup timestamps after install
   - Restore drill into scratch CT **now**, then quarterly

6. **GitHub**
   - Not a DB/media backup
   - Ruleset + optional pull-mirror for code; never commit `backups/` (gitignored)

## Operator check (run on CT 103 / pve2)

```bash
# Is nightly dump installed?
crontab -l 2>/dev/null; systemctl list-timers | grep -i backup || true
ls -lt /var/backups/jojo-postgres 2>/dev/null | head

# Media included?
# (document your restic/PBS job id here once created)
```

## Related

- [agent-safety.md](agent-safety.md) — who can touch what
- [deploy/bizarre-api/README.md](../../deploy/bizarre-api/README.md) — tree split + media path
