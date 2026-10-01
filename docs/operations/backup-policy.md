# Backup policy (production)

Goal: if an agent (or human) wrecks CT 103, restore is boring — not a Reddit post.

## What must be backed up

| Asset | Why |
|-------|-----|
| Postgres (`bizarre_db`) | Campaign / character / session state |
| `/var/lib/bizarre/media` | Uploads — **not** in `pg_dump` |
| Code | Git remote + optional pull-mirror (Forgejo/Gitea) |
| Secrets | `/etc/bizarre/prod.env` — Vault / KeePass copy, **not** in git or agent paths |

## Installed on CT 103

| Mechanism | Role |
|-----------|------|
| [`postgres-media-backup.sh`](../../deploy/bizarre-api/postgres-media-backup.sh) | Nightly `pg_dump -Fc` + media tarball → `/var/backups/bizarre` (14d retention) |
| `bizarre-backup.timer` | systemd ~03:15 UTC |
| [`copy-prod-env-to-vault.sh`](../../deploy/bizarre-api/copy-prod-env-to-vault.sh) | Human copies `prod.env` into encrypted `~/Vault/...` |
| [`pbs-ct-backup.example.md`](../../deploy/bizarre-api/pbs-ct-backup.example.md) | Proxmox host backup of CT 103 → PBS **from pve2** (agent never has pve2 SSH) |
| [`restore-drill.sh`](../../deploy/bizarre-api/restore-drill.sh) | Scratch-CT restore checklist |

Also: [`scripts/backup-database.sh`](../../scripts/backup-database.sh) pre-deploy via `deploy-prod.sh`.

## Target policy

1. **Nightly on CT** — DB dump + media tar (timer above)  
2. **Off-host** — PBS job from pve2 and/or rsync `/var/backups/bizarre` somewhere the agent cannot delete  
3. **Secrets** — Vault copy of `prod.env` (madvillainy `~/Vault/secrets/bizarre-api/prod.env`)  
4. **Pre-change** — `pct snapshot 103 …` before agent triage  
5. **Verify** — restore drill quarterly ([`restore-drill.sh`](../../deploy/bizarre-api/restore-drill.sh))

## Operator check

```bash
systemctl list-timers | grep bizarre-backup
ls -lt /var/backups/bizarre | head
# On pve2 (ops config only):
#   pvesm list <pbs-storage> | grep 103
```

## Related

- [agent-safety.md](agent-safety.md) — who can touch what
- [deploy/bizarre-api/README.md](../../deploy/bizarre-api/README.md) — tree split + media path
