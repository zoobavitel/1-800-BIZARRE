# Codebase map (`docs/codebase/`)

Implementation-oriented docs: what each major area of the repo does and where to edit. **Game rules** live in [1(800)-Bizarre SRD.md](../1(800)-Bizarre%20SRD.md). **Narrative backend overview:** [backend_documentation.md](../backend_documentation.md).

| Doc | Covers |
|-----|--------|
| [scripts.md](scripts.md) | [`scripts/`](../../scripts/) — setup, dev, backup, deploy |
| [backend-app.md](backend-app.md) | [`backend/src/app/`](../../backend/src/app/) — settings, urls, WSGI/ASGI, `manage.py` |
| [backend-characters-core.md](backend-characters-core.md) | [`backend/src/characters/`](../../backend/src/characters/) — models, serializers, `views.py`, parsers, admin, services |
| [backend-characters-views.md](backend-characters-views.md) | [`backend/src/characters/views/`](../../backend/src/characters/views/) — DRF view modules |
| [backend-commands.md](backend-commands.md) | Management commands + loose `backend/src/*.py` scripts |
| [frontend.md](frontend.md) | [`frontend/src/`](../../frontend/src/) — hash routing, config, features, pages |

## Source index (quick)

| Path | Doc section |
|------|-------------|
| `scripts/*.sh` | [scripts.md](scripts.md) |
| `backend/src/app/settings.py`, `urls.py` | [backend-app.md](backend-app.md) |
| `backend/src/characters/models.py` | [backend-characters-core.md](backend-characters-core.md) |
| `backend/src/characters/views/*.py` | [backend-characters-views.md](backend-characters-views.md) |
| `backend/src/characters/management/commands/` | [backend-commands.md](backend-commands.md) |
| `frontend/src/index.js`, `config/apiConfig.js` | [frontend.md](frontend.md) |

**Maintainer:** Optional Cursor subagent [`.cursor/agents/codebase-docs-maintainer.md`](../../.cursor/agents/codebase-docs-maintainer.md) keeps this folder aligned when code changes.
