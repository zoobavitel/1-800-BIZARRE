---
name: before-pr-build
description: Run npm run build in frontend and Django tests before a PR when venv exists. Invoke via /before-pr-build for explicit PR prep.
disable-model-invocation: true
---

# Before PR — build & tests

## When to use

- Before opening or updating a pull request.
- When the user types `/before-pr-build` or asks to verify build/tests.

## Instructions

1. From `frontend/`, run `npm run build` and fix compile errors.
2. If a Python venv with Django is available, from `backend/src/` run `python manage.py test` scoped to touched apps (e.g. `characters`). If Django is unavailable, note that in the PR and rely on CI.

## Output

Summarize commands run and pass/fail/skipped.
