---
name: pr-no-plan-files
description: Reminds not to edit Cursor plan markdown in implementation PRs. Invoke via /pr-no-plan-files.
disable-model-invocation: true
---

# PR — no plan file churn

## When to use

- Implementation or bugfix work that should not touch planning docs.
- When the user types `/pr-no-plan-files`.

## Instructions

- Do **not** edit `*.plan.md` under `.cursor/plans/` in feature/fix PRs unless the PR is planning-only.
- Confirm whether any plan files changed; if so, flag for removal unless doc-only.

## Output

Confirmation of plan file status.
