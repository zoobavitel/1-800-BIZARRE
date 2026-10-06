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

**Done (2026-10-01):** Cursor Host → `User agent`; ops via `~/.ssh/config.ops-human-only`; `bizarre_ro` + Vault helper; prod touch/cat denied for `agent`.

Run once as root (if rebuilding):

```bash
bash /opt/bizarre/deploy/bizarre-api/setup-agent-user.sh
AGENT_RO_PASSWORD='…' bash /opt/bizarre/deploy/bizarre-api/setup-agent-user.sh
```

Expect:

| Control | Intent |
|---------|--------|
| User `agent` | Not root, not app user |
| `systemd-journal` / `adm` | Read logs |
| `prod.env` `640 root:bizarre` | Deploy group can read; agent (not in `bizarre`) cannot |
| `/opt/bizarre-prod`, `/var/lib/bizarre` | No write for agent |
| sudoers | `systemctl status` / `journalctl` only — **no restart** |
| Postgres `bizarre_ro` | `SELECT` only + `default_transaction_read_only` |
| `.cursor/hooks*` | root-owned, no group/other write |

**Never** give the agent SSH to **pve2** itself.

Before each triage session (on pve2, as you):

```bash
pct snapshot 103 pre-agent-$(date +%F-%H%M)
```

Fixes: diagnose on CT 103 → edit on madvillainy / `/opt/bizarre` → PR → deploy. No hot-edits on prod.

## madvillainy

- SSH: `bizarre-api-agent` → `User agent` only; ops Include for root/pve2
- Terminal **auto-run off** (or tight allowlist) in Cursor settings
- Encrypted `~/Vault` for `prod.env` / `bizarre_ro` backups (not paid 1Password required)
- Project hooks: write-target tripwires; Unix ownership is the wall

## GitHub

- Ruleset on `master`: block force-push + branch deletion; require PR
- Agent `gh` token: fine-grained, this repo only, no Administration
- Do not let the agent inherit a full-scope personal login

## Quick rogue test

Assume agent goes rogue with whatever its shell can reach.

- Acceptable: trash feature branch / `bizarre_db_dev` → restore last night
- Not acceptable: wipe prod, delete GitHub repo, destroy CT from pve2 → fix layer 1

## Cursor Run Mode (human — desktop)

On madvillainy Cursor: **Settings → Agents → Approvals & Execution**.

- Prefer **Allowlist** with an empty/minimal allowlist (asks for nearly everything), or keep **Auto-review** with project [`.cursor/permissions.json`](../../.cursor/permissions.json) block instructions.
- Do **not** use **Run Everything**.

Project file [`.cursor/permissions.json`](../../.cursor/permissions.json) steers Auto-review toward asking on SSH, force-push, prod paths, and hook rewrites.
