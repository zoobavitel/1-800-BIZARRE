# .github/workflows/

GitHub Actions definitions for the 1-800-BIZARRE repo. The high-level overview, contributor flow, and "reproduce CI locally" recipes live in [`../README.md`](../README.md); this file is the per-workflow index.

## Workflows

| Workflow | Trigger | What it does |
|----------|---------|--------------|
| [`ci.yml`](ci.yml) | Push + PR to `master` / `main` | Frontend job (`npm ci`, `jest --coverage`, `eslint`, `npm run build`), backend job (`pip install`, `manage.py test`, `makemigrations --check`), integration job (boots Django, runs `RUN_BACKEND_INTEGRATION=1` Jest suite). On `master` / `main` pushes also runs `deploy-github-pages` and the optional `deploy-lxc` (manual `workflow_dispatch`). |
| [`secret-scan.yml`](secret-scan.yml) | Push + PR | Runs `gitleaks` with the repo-root [`.gitleaks.toml`](../../.gitleaks.toml) rule set. |
| [`black-autofix-pr.yml`](black-autofix-pr.yml) | PR | Auto-formats Python with `black` and pushes the fix back to the PR branch. |
| [`daily-critical-bug-review.yml`](daily-critical-bug-review.yml) | Scheduled (daily) | Runs [`scripts/daily_critical_bug_review.py`](../../scripts/daily_critical_bug_review.py) to surface high-risk diffs from the last day. |

## Versions of record

CI is authoritative for tool versions:

- **Node** 24 (`node-version` in `ci.yml`).
- **Python** 3.11.

Root `package.json` lists `engines.node` as `>=18` for local convenience; CI is the source of truth.

## Adding / editing a workflow

1. Edit / add the `.yml` file here.
2. Keep CI fast — if a new check is slow, gate it on path filters or run it on a schedule rather than every PR.
3. If the workflow needs new secrets, document them in [`../README.md`](../README.md) under **Deployment (CI)**.
4. Test by pushing to a feature branch; GitHub will run the workflow on the PR.
