# Test Pyramid

This project uses a four-layer test pyramid:

1. `unit`
2. `integration`
3. `automated-ui`
4. `manual`

Lower layers run more often and must stay fast. Top layer runs less often and focuses on release confidence.

## Command Matrix

| Layer | Scope | Command |
| --- | --- | --- |
| Unit | Pure logic and isolated API helpers | `npm run test:unit` |
| Integration | Frontend-backend contracts and core API flows | `npm run test:integration` |
| Automated UI | Browser smoke flows (login, character save) | `npm run test:automated-ui` |
| Manual | Release signoff protocol and evidence capture | `npm run test:manual` |
| Performance | Manual-first budget checks + optional automation | `npm run test:performance` |

## CI Gate Policy

- Pull requests:
  - required: `unit`
  - required: `integration`
  - required: `automated-ui` smoke
- Release/deploy:
  - required: `manual` signoff
  - required: performance budget checks (manual gate first, then automated fail-on-regression once baseline is stable)

## Coverage Targets

- Frontend Jest coverage threshold enforced in `frontend/package.json`.
- Backend coverage threshold enforced by `coverage report --fail-under` in root scripts.

## Critical Flow Coverage

Integration and automated-ui coverage should protect:

- Auth bootstrap (`signup/login/me`)
- Character lifecycle (`create/edit/delete`)
- Session roll loop (`roll-action`, session-linked roll history)
