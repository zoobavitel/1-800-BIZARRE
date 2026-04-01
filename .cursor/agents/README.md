# Custom subagents (Cursor)

Markdown files in this directory define **subagents**: specialized assistants with YAML frontmatter (`name`, `description`, optional `model`, `readonly`). See [Cursor docs — Subagents](https://cursor.com/docs).

| File | Purpose |
|------|---------|
| [api-parity-checker.md](api-parity-checker.md) | Frontend ↔ backend parity for rolls / `roll_action` / `extreme` vs legacy `greater` |
| [srd-alignment-spot-check.md](srd-alignment-spot-check.md) | Rules vs `docs/1(800)-Bizarre SRD.md` |
| [migration-sanity.md](migration-sanity.md) | Migrations, `on_delete`, session roll history |
| [test-runner-django-frontend.md](test-runner-django-frontend.md) | `manage.py test` + `npm run build` |
| [security-hardening-web.md](security-hardening-web.md) | Web research + Django/React security hardening with tests and `check --deploy` |
| [feature-branch-git.md](feature-branch-git.md) | New feature/fix work on a branch from updated `master` (not on `master`) |

**Invoke:** `/api-parity-checker` (or natural language: “run the api-parity-checker subagent on …”) from Agent chat.

**Skills** (domain packages, progressive loading) live in [`.cursor/skills/`](../skills/). **Agent Skills** open standard: [agentskills.io](https://agentskills.io).
