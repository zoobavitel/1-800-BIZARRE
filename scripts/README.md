# scripts/

Shell scripts for setup, local development, database backup, and production deployment for the **1-800-BIZARRE** / **1-800-BIZARRE** monorepo.

**Full documentation:** [docs/codebase/scripts.md](../docs/codebase/scripts.md) (purpose, usage, env vars, venv notes).

## Scripts at a glance

| Script | Role |
|--------|------|
| [setup.sh](setup.sh) | Initial install: npm, frontend deps, `backend/venv`, migrate, loaddata, `.env` stub |
| [start_dev.sh](start_dev.sh) | Background Django + React; PIDs in `.dev_pids` (uses `~/.virtualenvs/jojo`) |
| [backup-database.sh](backup-database.sh) | SQLite or PostgreSQL backup to `backups/` |
| [deploy-prod.sh](deploy-prod.sh) | Prod deploy: backup, migrate, collectstatic, tests, gunicorn |
| [production-deployment-checklist.sh](production-deployment-checklist.sh) | Prints a human checklist (no side effects) |

## Purpose

- **Automate** multi-step tasks (setup, deploy, backup).
- **Standardize** how developers and CI run the same flows.
- **Document** operations in one place (see `docs/codebase/scripts.md`).

## Key Contents

*   `setup.sh` — New clone / clean backend setup; creates `backend/venv` and loads fixtures.
*   `start_dev.sh` — Optional alternative to `npm run dev`; different venv path than root `package.json`.
*   `backup-database.sh` — Used standalone or from `deploy-prod.sh`.
*   `deploy-prod.sh` — Production Django sequence with gunicorn (requires env secrets).
*   `production-deployment-checklist.sh` — Echoed checklist for release verification.

## Code Quality and Structure

Placing utility scripts in a dedicated `scripts/` directory is a common and effective practice. This organization ensures:
*   **Discoverability**: Scripts are easily found and understood as operational tools.
*   **Separation of Concerns**: Keeps automation logic separate from application source code.
*   **Reusability**: Scripts can be called from various contexts (e.g., local development, CI/CD pipelines).

## Logic Behind Decisions

The decision to centralize operational scripts in the `scripts/` directory is driven by the need for efficient and reliable project management. Automating deployment and setup processes is crucial for reducing errors and accelerating development cycles. These scripts act as a form of executable documentation for critical operational procedures, ensuring that the project can be consistently set up and deployed by anyone involved.

**Note on "Logic Behind Decisions"**: The explanations regarding decision logic primarily reflect discussions from the current chat session and general software engineering best practices. This document does not have access to the full history of all previous, unlogged interactions or design discussions that may have influenced the project's evolution.