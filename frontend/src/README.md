# frontend/src/

React 18 SPA source (CRA / `react-scripts`). **Hash routing** in [`index.js`](index.js) — not React Router.

| Topic | Doc |
|-------|-----|
| Full map (routes, features, SRD touchpoints, API) | [`docs/codebase/frontend.md`](../../docs/codebase/frontend.md) |
| Canonical game rules | [`docs/1-(800)-BIZARRE SRD.md`](../../docs/1-(800)-BIZARRE%20SRD.md) |
| Rules in dev / at table | [`docs/GAME_RULES.md`](../../docs/GAME_RULES.md) |

**Day-to-day:** API base → [`config/apiConfig.js`](config/apiConfig.js); hash links → [`utils/spaNavigation.js`](utils/spaNavigation.js); main HTTP client → [`features/character-sheet/services/api.js`](features/character-sheet/services/api.js).

**Tests:** colocated `*.test.{js,jsx}`; integration in [`integration/`](integration/) (`npm run test:integration:frontend` from repo root); E2E in [`../e2e/`](../e2e/).
