# docs/

Project documentation hub: game rules of record, codebase maps, integration / deploy guides, and operational checklists.

The canonical **game rules** live in [`1(800)-Bizarre SRD.md`](1\(800\)-Bizarre%20SRD.md). The backend's validation logic should match it; deviations must be called out in PRs per [`../.cursor/rules/pr-doc-links-mechanics.mdc`](../.cursor/rules/pr-doc-links-mechanics.mdc).

## Game rules (SRD)

| File | Role |
|------|------|
| [`1(800)-Bizarre SRD.md`](1\(800\)-Bizarre%20SRD.md) | Player-facing SRD. Source of truth. Copied into `frontend/public/srd/` at build time. |
| [`1(800)-Bizarre SRD_DEV.md`](1\(800\)-Bizarre%20SRD_DEV.md) | Work-in-progress rules being staged before they land in the public SRD. |
| [`GAME_RULES.md`](GAME_RULES.md) | Short summaries / quick references derived from the SRD. |
| [`NPC_CREATION_RULES.md`](NPC_CREATION_RULES.md) | NPC-specific rules (lighter than PC validation). |
| [`stand_coin_srd_dev_contract.md`](stand_coin_srd_dev_contract.md) | Contract between Stand Coin SRD changes and the dev branch. |

## Codebase map

[`codebase/`](codebase/) — file- and module-level implementation index. Start with [`codebase/README.md`](codebase/README.md).

| Doc | Covers |
|-----|--------|
| [`codebase/backend-app.md`](codebase/backend-app.md) | `backend/src/app/` (settings, URLs, Celery). |
| [`codebase/backend-characters-core.md`](codebase/backend-characters-core.md) | `characters/` models, serializers, services. |
| [`codebase/backend-characters-views.md`](codebase/backend-characters-views.md) | DRF view modules under `characters/views/`. |
| [`codebase/backend-commands.md`](codebase/backend-commands.md) | `manage.py` custom commands. |
| [`codebase/frontend.md`](codebase/frontend.md) | `frontend/src/` — hash routing, features, pages. |
| [`codebase/scripts.md`](codebase/scripts.md) | Shell + Node helpers under `../scripts/`. |
| [`codebase/standard-ability-roll-bonus-audit.md`](codebase/standard-ability-roll-bonus-audit.md) | Ability `+1d` / `+1 effect` UI rules audit. |

## Backend & API

| File | Role |
|------|------|
| [`backend_documentation.md`](backend_documentation.md) | Narrative architecture overview. |
| [`API_USAGE.md`](API_USAGE.md) | API consumption examples (signup, login, character CRUD via curl). |
| [`SESSION_MANAGEMENT.md`](SESSION_MANAGEMENT.md) | Session / faction model overview (factions, sessions, events). For per-field detail see [`codebase/backend-characters-core.md`](codebase/backend-characters-core.md). |
| [`SRD_INTEGRATION.md`](SRD_INTEGRATION.md) | How SRD data flows into fixtures, backend validation, and frontend rendering. |

## Development / testing / release

| File | Role |
|------|------|
| [`development.md`](development.md) | Local-dev walkthrough (clone → venv → migrate → `npm run dev`). |
| [`TEST_PYRAMID.md`](TEST_PYRAMID.md) | Test taxonomy (unit / integration / automated-UI / manual) + CI gates + coverage expectations. |
| [`E2E_TOOL_DECISION.md`](E2E_TOOL_DECISION.md) | Why Playwright for end-to-end. |
| [`MANUAL_RELEASE_SIGNOFF.md`](MANUAL_RELEASE_SIGNOFF.md) | Manual checks performed before deploy. Driven by [`../scripts/manual-release-signoff.sh`](../scripts/manual-release-signoff.sh). |
| [`BRANCH_FLOW.md`](BRANCH_FLOW.md) | Branching model + PR conventions. |

## Deployment

| File | Role |
|------|------|
| [`DEPLOY_GITHUB_PAGES.md`](DEPLOY_GITHUB_PAGES.md) | Static frontend deploy via GitHub Pages. |
| [`DEPLOY_SQLITE_TO_POSTGRES.md`](DEPLOY_SQLITE_TO_POSTGRES.md) | One-time SQLite → Postgres migration for the LXC deploy. |
| [`operations/session-status-prod-checklist.md`](operations/session-status-prod-checklist.md) | Production session-status sanity checks. |

## Conventions

- The SRD markdown is authoritative — don't change behavior in code without first updating the SRD section it relates to.
- Long-form plans / specs live under `~/.cursor/plans/` (out of repo); only stable references belong here.
- When a rule-driven file changes (rolls, XP, stress, sessions, advancement), include a **References** line in the PR pointing at the relevant SRD section, per [`../.cursor/rules/pr-doc-links-mechanics.mdc`](../.cursor/rules/pr-doc-links-mechanics.mdc).
