---
name: restore-drill
description: >-
  Coach a practice restore of 1-800-BIZARRE backups onto a scratch CT only.
  Use when the user says restore drill, practice restore, test backup, or
  quarterly restore. Checklist-only by default; never restore onto live CT 103.
---

# Restore drill (OPSEC-safe coach)

This skill does **not** grant privileges. Unix permissions and Cursor hooks still bind. Prefer explaining steps over running them.

## Hard rules (always)

- **Coach first.** Print the checklist. Do **not** execute Proxmox clone/restore/destroy unless the user explicitly asks to run commands **and** names a scratch VMID that is **not** `103`.
- **Never** restore onto live CT **103**, `/opt/bizarre-prod`, or the live prod DB/media.
- **Never** SSH to `pve2`, `root@bizarre-api`, or open `~/.ssh/config.ops-human-only` from the agent session. Human ops use that config; agent stays on `User agent` only.
- **Never** read `/etc/bizarre/prod.env`, Vault passwords, or paste secrets into chat. Say “from Vault” / “ops root only”.
- Destroying a scratch CT only after smoke test, and only the user-confirmed scratch VMID.

## When to use

- User asks for a restore drill, practice restore, “test our backups”, or quarterly restore verification.

## First action

From repo root, print the canonical checklist (source of truth — do not invent a second procedure):

```bash
bash deploy/bizarre-api/restore-drill.sh
```

If the script is unavailable, read [`deploy/bizarre-api/restore-drill.sh`](../../deploy/bizarre-api/restore-drill.sh) and show the same steps. Policy context: [`docs/operations/backup-policy.md`](../../docs/operations/backup-policy.md).

## Path A — full drill (scratch CT; human on pve2)

Agent **describes**; human runs on pve2 via ops SSH config:

1. Clone CT 103 → unused scratch VMID (example `199`), hostname `bizarre-restore-drill`.
2. Start scratch; enter as root (ops).
3. `systemctl stop gunicorn celery-worker || true`
4. Restore DB dump from `/var/backups/bizarre/bizarre_db-*.dump` with `pg_restore … --clean --if-exists` (password from Vault — not chat).
5. Restore media: `tar -C /var/lib/bizarre -xzf …/media-*.tar.gz`
6. Install secrets: Vault `prod.env` → `/etc/bizarre/prod.env` mode `600`
7. Start gunicorn/celery; smoke test: login, campaign with images, one roll.
8. Stop and destroy **only** the scratch VMID.

## Path B — same-host dry run (read-only)

Ops root on CT 103 (not the agent user if dumps are root-only):

```bash
ls -lt /var/backups/bizarre | head
pg_restore -l /var/backups/bizarre/bizarre_db-<STAMP>.dump | head
tar -tzf /var/backups/bizarre/media-<STAMP>.tar.gz | head
```

Use real filenames from `ls`, not a `LATEST` placeholder.

## Pass criteria

- Scratch (or dry-run listing) proves backup is readable.
- Full drill: login + images + one roll on scratch, then scratch destroyed.
- Note the date in ops notes / chat for the next quarterly drill.

## Related

- [`deploy/bizarre-api/restore-drill.sh`](../../deploy/bizarre-api/restore-drill.sh)
- [`docs/operations/backup-policy.md`](../../docs/operations/backup-policy.md)
- [`docs/operations/agent-safety.md`](../../docs/operations/agent-safety.md)
