#!/usr/bin/env bash
# Restore drill checklist for CT 103 — run manually; prints steps, no destructive defaults.
set -euo pipefail

cat <<'EOF'
=== 1-800-BIZARRE restore drill ===

Prereqs: PBS / host CT backup or /var/backups/bizarre dumps; Vault copy of prod.env.

A) Scratch CT (preferred)
  1. On pve2: clone CT 103 to unused VMID 199 (hostname bizarre-restore-drill)
  2. Start 199; enter as root
  3. Stop app: systemctl stop gunicorn celery-worker || true
  4. Restore DB:
       export PGPASSWORD=…
       pg_restore -h localhost -U bizarre -d bizarre_db --clean --if-exists /path/to/bizarre_db-*.dump
  5. Restore media:
       tar -C /var/lib/bizarre -xzf /path/to/media-*.tar.gz
  6. Restore secrets:
       install -m 600 /path/from/Vault/prod.env /etc/bizarre/prod.env
  7. systemctl start gunicorn celery-worker
  8. Click through: login, campaign with images, one roll
  9. Destroy scratch CT 199 when done

B) Same-host dry run (read-only verify)
  ls -lt /var/backups/bizarre | head
  pg_restore -l /var/backups/bizarre/bizarre_db-LATEST.dump | head
  tar -tzf /var/backups/bizarre/media-LATEST.tar.gz | head

Record date of last successful drill in ops notes.
EOF
