# Agent safety (madvillainy ↔ CT 103)

Threat model: Cursor on **madvillainy** (or the `/opt/bizarre` agent tree) sometimes SSHs into **pve2 CT 103 (bizarre-api)** for triage. The agent is *allowed* on the box — but must **look at anything, break nothing** without a human.

Hooks/rules are **tripwires**. Least privilege + recoverable backups do the real work.

## Scope: `/opt/bizarre` vs `/opt/bizarre-prod`

| Path | Role |
|------|------|
| `/opt/bizarre` | Agent workspace. Hooks/rules ship here. Fixes and PRs happen here. |
| `/opt/bizarre-prod` | Prod checkout. Not a Cursor project. Agent must not write here; CT 103 setup locks it down. |

## Layer order

1. **Least privilege** — agent identity cannot destroy prod
2. **Recoverability** — backups the agent cannot delete ([backup-policy.md](backup-policy.md))
3. **Hooks** — catch honest mistakes ([`.cursor/hooks.json`](../../.cursor/hooks.json))
4. **Rules** — intent only ([`.cursor/rules/destructive-ops-deny.mdc`](../../.cursor/rules/destructive-ops-deny.mdc))

## CT 103 (bizarre-api)

Run once as root:

```bash
bash /opt/bizarre/deploy/bizarre-api/setup-agent-user.sh
# optional RO DB:
AGENT_RO_PASSWORD='…' bash /opt/bizarre/deploy/bizarre-api/setup-agent-user.sh
```

Expect:

| Control | Intent |
|---------|--------|
| User `agent` | Not root, not app user |
| `systemd-journal` / `adm` | Read logs |
| `prod.env` mode `600` | Agent cannot read secrets |
| `/opt/bizarre-prod`, `/var/lib/bizarre` | No write for agent |
| sudoers | `systemctl status` / `journalctl` only — **no restart** |
| Postgres `bizarre_ro` | `SELECT` only + `default_transaction_read_only` |
| SSH key | 1Password; `authorized_keys` with `from=<madvillainy IP>`, `no-agent-forwarding` |

**Never** give the agent SSH to **pve2** itself (`pct destroy`, host backups, `pct enter` as root).

Before each triage session (on pve2, as you):

```bash
pct snapshot 103 pre-agent-$(date +%F-%H%M)
```

Fixes: diagnose on CT 103 → edit on madvillainy / `/opt/bizarre` → PR → deploy. No hot-edits on prod. Invasive repro: `pct clone 103` scratch CT.

## madvillainy

- SSH config: only `bizarre-api-agent` in the file Cursor can read — see [ssh-config.madvillainy.example](../../deploy/bizarre-api/ssh-config.madvillainy.example)
- Turn **off** terminal auto-run (or tight allowlist)
- 1Password SSH agent for keys
- Project hooks deny force-push, `rm` outside workspace, Proxmox SSH, prod paths; **ask** on `ssh bizarre-api-agent`

## GitHub

- Ruleset on `master`: block force-push + branch deletion; require PR
- Agent `gh` token: fine-grained, this repo only, no Administration
- Do not let the agent inherit a full-scope personal login

## Quick rogue test

Assume agent goes rogue with whatever its shell can reach.

- Acceptable: trash feature branch / `bizarre_db_dev` → restore last night
- Not acceptable: wipe prod, delete GitHub repo, destroy CT from pve2 → fix layer 1

## Hook tests

```bash
python3 .cursor/hooks/test_hooks.py
```
