# Automated UI Tool Decision: Playwright vs Cypress

## Repo Constraints

- Frontend: React (`react-scripts`) in `frontend/`
- Backend: Django API in `backend/src/`
- CI: GitHub Actions (`.github/workflows/ci.yml`)
- Priority: stable smoke flows first, broad E2E later

## Comparison

| Area | Playwright | Cypress |
| --- | --- | --- |
| Browser support | Chromium, Firefox, WebKit out of box | Chrome-family first, Firefox support available |
| Parallel CI scaling | Strong built-in sharding and retries | Good, often plugin-driven in larger suites |
| Cross-origin / multi-tab | Strong support | Improved, still more constraints in some workflows |
| Debug UX | Trace viewer, screenshots, videos | Excellent interactive runner |
| Setup for this repo | Simple config + smoke spec | Simple config + spec |

## Decision

Choose `Playwright` for initial automated-ui layer because:

1. Better multi-browser path for future confidence.
2. Good CI stability primitives (retries + traces) with minimal wiring.
3. Works well for smoke-first approach in this codebase.

## Pilot Scope

- Add one smoke test: app shell loads.
- Keep flow small and deterministic.
- Expand to login + character persistence in next iteration.
