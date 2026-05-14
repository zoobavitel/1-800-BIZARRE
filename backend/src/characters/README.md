# backend/src/characters/

The `characters` Django app. Despite the name it owns most of the game-data backbone: PCs, NPCs, Stands, Heritages, Abilities, Sessions, Rolls, XP, stress, traumas, group actions, and the assist / push / fortune mechanics. Newer sibling apps (`authentication/`, `campaigns/`, `crews/`, `factions/`) gradually peel off domains as the project grows, but most active development still happens here.

## Top-level files

| File | Role |
|------|------|
| [`models.py`](models.py) | All Django models for game entities and history rows. |
| [`serializers.py`](serializers.py) | DRF serializers; the bulk of input validation lives here. |
| [`views.py`](views.py) | Legacy view module. **Still active** — not all endpoints have been migrated to `views/`. |
| [`views/`](views/) | Per-domain DRF view modules (character, campaign, NPC, crew, session, auth, gameplay, reference, utility). See [`views/README.md`](views/README.md). |
| [`views_sse.py`](views_sse.py) | Server-Sent Events endpoints for live campaign updates. |
| [`services/`](services/) | Business-logic layer pulled out of views. See [`services/README.md`](services/README.md). |
| [`admin.py`](admin.py) | Django admin registrations. |
| [`apps.py`](apps.py) | App config; wires `signals_realtime`. |
| [`parsers.py`](parsers.py) | Custom DRF parsers (multipart / image upload helpers). |
| [`realtime.py`](realtime.py), [`signals_realtime.py`](signals_realtime.py) | Pub/sub plumbing for SSE consumers. |
| [`roll_helpers.py`](roll_helpers.py) | Roll-resolution helpers (position/effect, action rolls, fortune, group actions). |
| [`history_context.py`](history_context.py) | Request-scoped context used when writing roll / XP / character-history rows. |
| [`test_legacy_models.py`](test_legacy_models.py) | Legacy top-level test file kept for historical fixtures; most tests live under [`tests/`](tests/). |
| [`BACKEND_REFACTORING.md`](BACKEND_REFACTORING.md) | Notes on the in-progress views.py → views/ split. Treat as historical context; reality is mid-migration. |

## Subdirectories

| Path | Role |
|------|------|
| [`data/`](data/) | Static reference data shipped with the code (separate from `fixtures/`). |
| [`fixtures/`](fixtures/) | SRD-derived seed JSON consumed by `loaddata` and the `load_srd_reference_data` command. |
| [`migrations/`](migrations/) | Django schema history (currently ~90 migrations). |
| [`management/`](management/) | Custom `manage.py` commands. See [`management/commands/README.md`](management/commands/README.md). |
| [`tests/`](tests/) | Active test suite. |

## Where to read more

- Implementation map: [`docs/codebase/backend-characters-core.md`](../../../docs/codebase/backend-characters-core.md), [`backend-characters-views.md`](../../../docs/codebase/backend-characters-views.md), [`backend-commands.md`](../../../docs/codebase/backend-commands.md).
- Narrative overview: [`docs/backend_documentation.md`](../../../docs/backend_documentation.md).
- Rules of record: [`docs/1-(800)-BIZARRE SRD.md`](../../../docs/1-\(800\)-BIZARRE%20SRD.md). Backend validation should match it; deviations must be noted in PRs.

## Conventions

- **Don't add one-off `.py` scripts** to this directory. Use a `management/commands/` command or a script under repo `scripts/`.
- **Migrations**: when changing models, run `python manage.py makemigrations` and commit the migration. CI fails on `makemigrations --check --dry-run` drift.
- **Game rules changes**: cross-check the SRD and call out deviations in the PR per [`.cursor/rules/pr-doc-links-mechanics.mdc`](../../../.cursor/rules/pr-doc-links-mechanics.mdc).
